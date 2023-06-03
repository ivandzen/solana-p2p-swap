use solana_sdk::ed25519_instruction::{
    DATA_START,
    PUBKEY_SERIALIZED_SIZE,
    SIGNATURE_SERIALIZED_SIZE,
    SIGNATURE_OFFSETS_SERIALIZED_SIZE,
    SIGNATURE_OFFSETS_START,
};
use {
    bytemuck::{ bytes_of, Pod, Zeroable },
    clap::{ App, Arg, ArgMatches, SubCommand },
    ed25519_dalek,
    p2p_swap::{
        SwapSPLOrder,
        get_order_wallet_address,
        get_order_wallet_authority,
        get_order_address,
        P2PSwapInstructions,
    },
    solana_client::rpc_client::RpcClient,
    solana_clap_utils::{
        input_validators::{is_valid_pubkey, is_url_or_moniker, normalize_to_url_if_moniker},
        keypair::signer_from_path,
    },
    solana_sdk::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        program_pack::Pack,
        signer::Signer,
        signature::Signature,
        transaction::Transaction,
    },
    spl_token::state::Account as SPLAccount,
    std::{ process::exit, str::FromStr },
    log::{warn},
};

fn is_valid_u64<T>(value: T) -> Result<(), String>
    where
        T: AsRef<str>,
{
    let str_ref = value.as_ref();
    str_ref.parse::<u64>()
        .map_err(|err| format!("Failed to parse u64 {:?}: {:?}", str_ref, err))?;

    Ok(())
}

fn is_valid_bool<T>(value: T) -> Result<(), String>
    where
        T: AsRef<str>,
{
    let str_ref = value.as_ref().to_lowercase();
    match str_ref.as_str() {
        "true" | "1" | "yes" | "y" => Ok(()),
        "false" | "0" | "no" | "n" => Ok(()),
        _ => Err(format!("Unexpected value {:?}", str_ref))
    }
}

fn parse_bool<T>(value: T) -> Result<bool, String>
    where
        T: AsRef<str>,
{
    let str_ref = value.as_ref().to_lowercase();
    match str_ref.as_str() {
        "true" | "1" | "yes" | "y" => Ok(true),
        "false" | "0" | "no" | "n" => Ok(false),
        _ => Err(format!("Unexpected value {:?}", str_ref))
    }
}

#[derive(Default, Debug, Copy, Clone, Zeroable, Pod)]
#[repr(C)]
pub struct Ed25519SignatureOffsets {
    signature_offset: u16,             // offset to ed25519 signature of 64 bytes
    signature_instruction_index: u16,  // instruction index to find signature
    public_key_offset: u16,            // offset to public key of 32 bytes
    public_key_instruction_index: u16, // instruction index to find public key
    message_data_offset: u16,          // offset to start of message data
    message_data_size: u16,            // size of message data
    message_instruction_index: u16,    // index of instruction data to get message data
}


struct AppContext {
    client: RpcClient,
    p2p_swap: Pubkey,
    signer: Box<dyn Signer>,
}

impl AppContext {
    pub fn parse(args: &ArgMatches) -> Result<Self, String> {
        let p2p_swap = Pubkey::try_from(
            args.value_of("p2p-swap")
                .ok_or_else(|| "p2p-swap is not specified".to_string())?
        ).map_err(|_| "Failed to parse p2p_swap address".to_string())?;

        let solana_cli_config = args
            .value_of("config_file")
            .map_or_else(solana_cli_config::Config::default, |config_file| {
                solana_cli_config::Config::load(config_file).unwrap_or_default()
            });

        let json_rpc_url = normalize_to_url_if_moniker(
            args
                .value_of("json_rpc_url")
                .unwrap_or(&solana_cli_config.json_rpc_url),
        );

        let keypair_file = args.value_of("keypair")
            .unwrap_or(&solana_cli_config.keypair_path);

        let mut wallet_manager = None;
        let signer = signer_from_path(args, keypair_file, "keypair", &mut wallet_manager)
            .map_err(|_| format!("Failed to load keypair from file {:?}", keypair_file))?;

        Ok(
            AppContext {
                client: RpcClient::new(json_rpc_url),
                p2p_swap,
                signer,
            }
        )
    }

    pub fn send_transaction(&self, instructions: &Vec<Instruction>) -> Result<Signature, String> {
        let mut transaction =
            Transaction::new_with_payer(instructions, Some(&self.signer.pubkey()));

        let blockhash = self.client.get_latest_blockhash()
            .map_err(|err| format!("Failed to get latest blockhash: {:?}", err))?;
        transaction.try_partial_sign(&[self.signer.as_ref().clone()], blockhash)
            .map_err(|err| format!("Failed to partial sign: {:?}", err))?;
        transaction.try_sign(&[self.signer.as_ref().clone()], blockhash)
            .map_err(|err| format!("Failed to sign: {:?}", err))?;
        self.client.send_transaction(&transaction).map_err(|err| format!("Failed to send transaction: {:?}", err))
    }

    pub fn new_ed25519_signature_instruction(&self, order: &Pubkey, seller: &Pubkey, signature: Signature) -> Instruction {
        let pubkey = seller.to_bytes();
        let message = order.to_bytes();

        assert_eq!(pubkey.len(), PUBKEY_SERIALIZED_SIZE);
        assert_eq!(signature.as_ref().len(), SIGNATURE_SERIALIZED_SIZE);

        let mut instruction_data = Vec::with_capacity(
            DATA_START
                .saturating_add(SIGNATURE_SERIALIZED_SIZE)
                .saturating_add(PUBKEY_SERIALIZED_SIZE)
                .saturating_add(message.len()),
        );

        let num_signatures: u8 = 1;
        let public_key_offset = DATA_START;
        let signature_offset = public_key_offset.saturating_add(PUBKEY_SERIALIZED_SIZE);
        let message_data_offset = signature_offset.saturating_add(SIGNATURE_SERIALIZED_SIZE);

        // add padding byte so that offset structure is aligned
        instruction_data.extend_from_slice(bytes_of(&[num_signatures, 0]));

        let offsets = Ed25519SignatureOffsets {
            signature_offset: signature_offset as u16,
            signature_instruction_index: u16::MAX,
            public_key_offset: public_key_offset as u16,
            public_key_instruction_index: u16::MAX,
            message_data_offset: message_data_offset as u16,
            message_data_size: message.len() as u16,
            message_instruction_index: u16::MAX,
        };

        instruction_data.extend_from_slice(bytes_of(&offsets));

        debug_assert_eq!(instruction_data.len(), public_key_offset);

        instruction_data.extend_from_slice(&pubkey);

        debug_assert_eq!(instruction_data.len(), signature_offset);

        instruction_data.extend_from_slice(&signature.as_ref());

        debug_assert_eq!(instruction_data.len(), message_data_offset);

        instruction_data.extend_from_slice(&message);

        Instruction {
            program_id: solana_sdk::ed25519_program::id(),
            accounts: vec![],
            data: instruction_data,
        }
    }
}

fn find_free_order_account(context: &AppContext) -> (Pubkey, u64) {
    let latest_slot = context.client.get_slot().unwrap();
    let (pubkey, _) = get_order_address(
        &context.p2p_swap,
        &context.signer.pubkey(),
        latest_slot,
    );

    if let Err(_) = context.client.get_account(&pubkey) {
        // account absent
        return (pubkey, latest_slot)
    }

    panic!("Unable to generate new order address");
}

fn process_create_order(context: &AppContext, args: &Option<&ArgMatches>) {
    if let Some(args) = args {
        let sell_token = Pubkey::try_from(args.value_of("sell-token").unwrap()).unwrap();
        let sell_amount = args.value_of("sell-amount").unwrap().parse::<u64>().unwrap();
        let sell_minimum = args.value_of("sell-minimum").unwrap().parse::<u64>().unwrap();
        let buy_token = Pubkey::try_from(args.value_of("buy-token").unwrap()).unwrap();
        let buy_amount = args.value_of("buy-amount").unwrap().parse::<u64>().unwrap();
        let is_private = parse_bool(args.value_of("is_private").unwrap()).unwrap();

        let signer_wallet = spl_associated_token_account::get_associated_token_address(
            &context.signer.pubkey(),
            &sell_token,
        );

        if context.client.get_account(&signer_wallet).ok() == None {
            panic!("Seller has no wallet for token {:?}", sell_token);
        }

        let order_wallet_authority =
            get_order_wallet_authority(&context.p2p_swap, &context.signer.pubkey()).0;

        let order_wallet = get_order_wallet_address(
            &sell_token,
            &order_wallet_authority,
        );

        let mut instructions = Vec::new();

        if context.client.get_account(&order_wallet).ok() == None {
            instructions.push(
                spl_associated_token_account::instruction::create_associated_token_account(
                    &context.signer.pubkey(),
                    &order_wallet_authority,
                    &sell_token,
                    &spl_token::id(),
                )
            )
        }

        instructions.push(spl_token::instruction::approve(
            &spl_token::id(),
            &signer_wallet,
            &context.p2p_swap,
            &context.signer.pubkey(),
            &[&context.signer.pubkey()],
            sell_amount,
        ).unwrap());

        let (order_account, order_seed) = find_free_order_account(context);

        let mut sell_amount = sell_amount.to_le_bytes().to_vec();
        let mut buy_amount = buy_amount.to_le_bytes().to_vec();
        let mut min_sell_amount = sell_minimum.to_le_bytes().to_vec();
        let order_seed_arr = order_seed.to_le_bytes().to_vec();

        if is_private {
            let mut data: Vec<u8> = vec![P2PSwapInstructions::CreatePrivateOrder as u8];
            data.append(&mut sell_amount);
            data.append(&mut buy_amount);
            data.append(&mut min_sell_amount);
            data.append(&mut order_seed_arr.clone());
            instructions.push(Instruction {
                program_id: context.p2p_swap.clone(),
                accounts: vec![
                    AccountMeta::new_readonly(solana_sdk::sysvar::clock::id(), false),
                    AccountMeta::new(context.signer.pubkey(), true),
                    AccountMeta::new(signer_wallet, false),
                    AccountMeta::new_readonly(sell_token.clone(), false),
                    AccountMeta::new_readonly(order_wallet_authority.clone(), false),
                    AccountMeta::new_readonly(buy_token.clone(), false),
                    AccountMeta::new(order_wallet, false),
                    AccountMeta::new_readonly(spl_token::id(), false),
                    AccountMeta::new(order_account, false),
                    AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
                ],
                data,
            });
        } else {
            let mut data: Vec<u8> = vec![P2PSwapInstructions::CreatePublicOrder as u8];
            data.append(&mut sell_amount);
            data.append(&mut buy_amount);
            data.append(&mut min_sell_amount);
            data.append(&mut order_seed_arr.clone());
            instructions.push(Instruction {
                program_id: context.p2p_swap.clone(),
                accounts: vec![
                    AccountMeta::new_readonly(solana_sdk::sysvar::clock::id(), false),
                    AccountMeta::new(context.signer.pubkey(), true),
                    AccountMeta::new(signer_wallet, false),
                    AccountMeta::new_readonly(sell_token.clone(), false),
                    AccountMeta::new_readonly(order_wallet_authority.clone(), false),
                    AccountMeta::new_readonly(buy_token.clone(), false),
                    AccountMeta::new(order_wallet, false),
                    AccountMeta::new_readonly(spl_token::id(), false),
                    AccountMeta::new(order_account, false),
                    AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
                ],
                data,
            });
        }

        let signature = context.send_transaction(&instructions).unwrap();

        println!("\n\nNew order created: {:?}", order_account);
        println!("Order seed: {:x?}", order_seed);
        println!("Transaction: {:?}", signature);
        if is_private {
            let unlock_signature = context.signer.try_sign_message(&order_account.to_bytes()).unwrap();
            println!("Order is private. Unlock signature: {:?}", unlock_signature.to_string());
        }

    } else {
        warn!("No args provided to create-order");
        exit(1);
    }
}

fn get_order(context: &AppContext, order: &Pubkey) -> Result<SwapSPLOrder, String> {
    let order = context.client.get_account(order)
        .map_err(|_| format!("Order {:?} not found", order))?;

    SwapSPLOrder::unpack(&order.data)
        .map_err(|_| format!("Failed to parse SwapSPLOrder from account {:?} data", order))
}

fn process_get_order(context: &AppContext, args: &Option<&ArgMatches>) {
    if let Some(args) = args {
        let order_address = Pubkey::try_from(args.value_of("order_address").unwrap()).unwrap();
        let order = get_order(context, &order_address).unwrap();
        println!("Order {:?}", order_address);
        println!("Data:");
        println!("{:?}", order);
    }
}

fn process_buy_order(context: &AppContext, args: &Option<&ArgMatches>) {
    if let Some(args) = args {
        let sell_token_amount = args.value_of("sell_token_amount").unwrap().parse::<u64>().unwrap();

        let order_address = Pubkey::try_from(args.value_of("order_address").unwrap()).unwrap();
        let order = get_order(context, &order_address).unwrap();

        let order_wallet_authority =
            get_order_wallet_authority(&context.p2p_swap, &context.signer.pubkey()).0;

        let order_wallet = context.client.get_account(&order.order_wallet).unwrap();
        let order_wallet = SPLAccount::unpack(&order_wallet.data).unwrap();

        let buyer_buy_token_wallet =
            spl_associated_token_account::get_associated_token_address(
                &context.signer.pubkey(),
                &order.price_mint,
            );

        let seller_buy_token_wallet =
            spl_associated_token_account::get_associated_token_address(
                &order.seller,
                &order.price_mint,
            );

        let buyer_sell_token_wallet =
            spl_associated_token_account::get_associated_token_address(
                &context.signer.pubkey(),
                &order_wallet.mint,
            );

        let mut instructions = Vec::new();

        let buy_token_amount = (sell_token_amount * order.buy_amount) / order.sell_amount;
        instructions.push(spl_token::instruction::approve(
            &spl_token::id(),
            &buyer_buy_token_wallet,
            &context.p2p_swap,
            &context.signer.pubkey(),
            &[&context.signer.pubkey()],
            buy_token_amount,
        ).unwrap());

        if order.is_private {
            if let Some(unlock_signature) = args.value_of("unlock_signature") {
                let unlock_signature = Signature::from_str(unlock_signature).unwrap();
                instructions.push(
                    context.new_ed25519_signature_instruction(
                        &order_address,
                        &order.seller,
                        unlock_signature
                    )
                );
            } else {
                println!("unlock_signature not specified");
                exit(1);
            }
        }

        let accounts = {
            let mut accounts = vec![
                AccountMeta::new_readonly(order.seller.clone(), false), // seller
                AccountMeta::new(context.signer.pubkey(), true),        // buyer
                AccountMeta::new(order_address.clone(), false),         // order
            ];

            if order.is_private {
                accounts.push(AccountMeta::new_readonly(solana_sdk::sysvar::instructions::id(), false));
            }

            accounts.append(
                &mut vec![
                    AccountMeta::new_readonly(order_wallet_authority.clone(), false), // order wallet authority
                    AccountMeta::new_readonly(order_wallet.mint.clone(), false),   // sell token mint
                    AccountMeta::new(order.order_wallet.clone(), false),    // order wallet
                    AccountMeta::new_readonly(order.price_mint, false),     // buy token mint
                    AccountMeta::new(buyer_buy_token_wallet, false),        // buyer buy token wallet
                    AccountMeta::new(seller_buy_token_wallet, false),       // seller buy token wallet
                    AccountMeta::new(buyer_sell_token_wallet, false),       // buyer sell token wallet
                    AccountMeta::new_readonly(spl_token::id(), false),      // token program
                ]
            );

            accounts
        };

        let mut data: Vec<u8> = vec![P2PSwapInstructions::FillOrder as u8];
        let mut sell_token_amount = sell_token_amount.to_le_bytes().to_vec();
        data.append(&mut sell_token_amount);
        instructions.push(Instruction {
            program_id: context.p2p_swap.clone(),
            accounts,
            data,
        });

        let signature = context.send_transaction(&instructions).unwrap();
        print!("transaction: {:?}", signature);
    }
}

fn main() {
    let matches = App::new("p2p-swap-cli")
        .about("CLI to interact with p2p-swap smart-contract")
        .arg({
            let arg = Arg::with_name("config_file")
                .short("C")
                .long("config")
                .value_name("PATH")
                .takes_value(true)
                .global(true)
                .help("Configuration file to use");

            if let Some(ref config_file) = *solana_cli_config::CONFIG_FILE {
                arg.default_value(config_file)
            } else {
                arg
            }
        })
        .arg(
            Arg::with_name("json_rpc_url")
                .short("u")
                .long("url")
                .value_name("URL")
                .takes_value(true)
                .global(true)
                .validator(is_url_or_moniker)
                .help("URL for Solana node"),
        )
        .arg(
            Arg::with_name("p2p-swap")
                .short("p")
                .long("p2p-swap")
                .value_name("P2P_SWAP")
                .takes_value(true)
                .required(false)
                .global(true)
                .validator(is_valid_pubkey)
                .help("Address of P2P-Swap smart contract")
        )
        .arg(
            Arg::with_name("keypair")
                .short("k")
                .long("keypair")
                .takes_value(true)
                .global(true)
                .help("Specify signer for transactions (use default solana account if not specified)")
        )
        .subcommand(
            SubCommand::with_name("create-order")
                .about("Creates new public order in p2p-swap")
                .arg(
                    Arg::with_name("sell-token")
                        .index(1)
                        .value_name("SELL_TOKEN")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_pubkey)
                        .help("Token mint of the token to sell")
                )
                .arg(
                    Arg::with_name("sell-amount")
                        .index(2)
                        .value_name("SELL_AMOUNT")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_u64)
                        .help("How much of sell-token to place into order \
                        (count in smallest possible portions - see decimals)")
                )
                .arg(
                    Arg::with_name("sell-minimum")
                        .index(3)
                        .value_name("SELL_MINIMUM")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_u64)
                        .help("The minimum amount of sell-token to buy \
                        (count in smallest possible portions - see decimals)")
                )
                .arg(
                    Arg::with_name("buy-token")
                        .index(4)
                        .value_name("BUY_TOKEN")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_pubkey)
                        .help("Token mint of the token to buy")
                )
                .arg(
                    Arg::with_name("buy-amount")
                        .index(5)
                        .value_name("BUY_AMOUNT")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_u64)
                        .help("How much of buy-token to receive in case order will be completely \
                        filled (count in smallest possible portions - see decimals). \
                        Actually, price of a single sell-token will be BUY_AMOUNT / SELL_AMOUNT")
                )
                .arg(
                    Arg::with_name("is_private")
                        .long("is-private")
                        .value_name("IS_PRIVATE")
                        .takes_value(true)
                        .required(false)
                        .default_value("false")
                        .validator(is_valid_bool)
                        .help("Whether to create private order")
                )
        )
        .subcommand(
            SubCommand::with_name("get-order")
                .about("Read order information from chain")
                .arg(
                    Arg::with_name("order_address")
                        .index(1)
                        .value_name("ORDER_ADDRESS")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_pubkey)
                        .help("base58 address of order (account)")
                )
        )
        .subcommand(
            SubCommand::with_name("buy-order")
                .about("Fills given order by buying specified amount of order token")
                .arg(
                    Arg::with_name("order_address")
                        .index(1)
                        .value_name("ORDER_ADDRESS")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_pubkey)
                        .help("base58 address of order (account)")
                )
                .arg(
                    Arg::with_name("sell_token_amount")
                        .index(2)
                        .value_name("AMOUNT")
                        .takes_value(true)
                        .required(true)
                        .validator(is_valid_u64)
                        .help("Amount of order token to buy")
                )
                .arg(
                    Arg::with_name("unlock_signature")
                        .long("unlock-signature")
                        .value_name("UNLOCK_SIGNATURE")
                        .takes_value(true)
                        .required(false)
                        .help("base58 encoded signature")
                )
        )
        .get_matches();

    let context = AppContext::parse(&matches).unwrap();
    let (subcommand, args) = matches.subcommand();

    match subcommand {
        "create-order" => process_create_order(&context, &args),
        "get-order" => process_get_order(&context, &args),
        "buy-order" => process_buy_order(&context, &args),
        _ => {
            warn!("Unknown subcommand '{:?}'", subcommand);
            exit(1)
        }
    }
}
