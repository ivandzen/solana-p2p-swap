use solana_program::sysvar;
use {
    crate::{
        SwapSPLOrder,
        get_order_wallet_address,
        get_order_address,
        get_order_wallet_authority,
        P2PSwapInstructions,
    },
    arrayref::{array_ref, array_refs},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint,
        entrypoint::ProgramResult,
        msg,
        program::{invoke, invoke_signed},
        program_error::ProgramError,
        program_pack::Pack,
        pubkey::Pubkey,
        rent::Rent,
        system_instruction, system_program,
        sysvar::Sysvar,
    },
    spl_token::state::Account as SPLAccount,
    std::ops::DerefMut,
};

entrypoint!(process_instruction);

pub fn create_account<'a>(
    system_account: &AccountInfo<'a>,
    program_id: &Pubkey,
    payer: &AccountInfo<'a>,
    new_account: &AccountInfo<'a>,
    signers_seeds: &[&[u8]],
    space: usize,
) -> Result<(), ProgramError> {
    let rent = Rent::get()?;
    let minimum_balance = rent.minimum_balance(space).max(1);

    if new_account.lamports() > 0 {
        let add_lamports = minimum_balance.saturating_sub(new_account.lamports());

        if add_lamports > 0 {
            invoke(
                &system_instruction::transfer(payer.key, new_account.key, add_lamports),
                &[
                    (*payer).clone(),
                    new_account.clone(),
                    system_account.clone(),
                ],
            )?;
        }

        invoke_signed(
            &system_instruction::allocate(new_account.key, space as u64),
            &[new_account.clone(), system_account.clone()],
            &[signers_seeds],
        )?;

        invoke_signed(
            &system_instruction::assign(new_account.key, program_id),
            &[new_account.clone(), system_account.clone()],
            &[signers_seeds],
        )
    } else {
        invoke_signed(
            &system_instruction::create_account(
                payer.key,
                new_account.key,
                minimum_balance,
                space as u64,
                program_id,
            ),
            &[
                (*payer).clone(),
                new_account.clone(),
                system_account.clone(),
            ],
            &[signers_seeds],
        )
    }
}

fn _create_order<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
    is_private: bool,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let (sell_amount, buy_amount, min_sell_amount, order_seed) = if instruction_data.len() == 32 {
        let instruction_data = array_ref![instruction_data, 0, 32];
        let (sell_amount, buy_amount, min_sell_amount, order_seed)
            = array_refs![instruction_data, 8, 8, 8, 8];
        (
            u64::from_le_bytes(*sell_amount),
            u64::from_le_bytes(*buy_amount),
            u64::from_le_bytes(*min_sell_amount),
            u64::from_le_bytes(*order_seed),
        )
    } else {
        msg!(
            "Invalid data - expected 32 bytes - {:?}",
            instruction_data,
        );
        return Err(ProgramError::InvalidInstructionData);
    };

    let seller = next_account_info(account_info_iter)?; // 1 - seller Pubkey

    let seller_token_account_info = next_account_info(account_info_iter)?; // 2 - seller token account
    let seller_token_account = SPLAccount::unpack(&seller_token_account_info.data.borrow())?;
    if seller_token_account.owner != *seller.key {
        msg!("Token account owner not match. Expected {:?}", seller.key,);
        return Err(ProgramError::InvalidAccountData);
    }

    let sell_token_mint = next_account_info(account_info_iter)?; // 3 - selling token mint
    if seller_token_account.mint != *sell_token_mint.key {
        msg!(
            "Token mint not match. Expected {:?}",
            seller_token_account.mint,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let (expected_order_wallet_authority, bump_seed) = get_order_wallet_authority(program_id, seller.key);
    let order_wallet_authority = next_account_info(account_info_iter)?; // 4 - order wallet authority
    if expected_order_wallet_authority != *order_wallet_authority.key {
        msg!(
            "Order wallet authority not match. Expected {:?}",
            expected_order_wallet_authority,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let buy_token_mint = next_account_info(account_info_iter)?; // 5 - buy token mint

    let order_wallet = next_account_info(account_info_iter)?; // 6 - order wallet address
    let expected_order_wallet = get_order_wallet_address(
        sell_token_mint.key,
        order_wallet_authority.key,
    );

    if expected_order_wallet != *order_wallet.key {
        msg!(
            "Locked walled not match. Expected {:?}",
            expected_order_wallet,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let token_program = next_account_info(account_info_iter)?; // 7 - token_program
    spl_token::check_program_account(token_program.key)?;

    invoke_signed(
        &spl_token::instruction::transfer(
            &spl_token::id(),
            seller_token_account_info.key,
            order_wallet.key,
            seller.key,
            &[],
            sell_amount,
        )?,
        &[
            seller_token_account_info.clone(),
            order_wallet.clone(),
            seller.clone(),
        ],
        &[&[b"OrderWalletAuthority", &seller.key.to_bytes(), &[bump_seed]]],
    )?;

    let order_account = next_account_info(account_info_iter)?; // 8 - order account
    let (expected_order_account, bump_seed) =
        get_order_address(program_id, seller.key, order_seed);
    if expected_order_account != *order_account.key {
        msg!(
            "Order account not match. Expected {:?}",
            expected_order_account,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let system_account = next_account_info(account_info_iter)?; // 9 - system account
    if !system_program::check_id(system_account.key) {
        msg!("System program not match. Got {:?}", system_account.key,);
        return Err(ProgramError::InvalidAccountData);
    }

    create_account(
        system_account,
        program_id,
        seller,
        order_account,
        &[
            b"OrderAccount",
            &seller.key.to_bytes(),
            &order_seed.to_le_bytes(),
            &[bump_seed],
        ],
        SwapSPLOrder::LEN,
    )?;

    let order = SwapSPLOrder {
        seller: seller.key.clone(),
        sell_amount,
        order_wallet: order_wallet.key.clone(),
        price_mint: buy_token_mint.key.clone(),
        buy_amount,
        min_sell_amount,
        remains_to_fill: sell_amount,
        is_private,
    };

    SwapSPLOrder::pack(order, order_account.data.borrow_mut().deref_mut())
}

fn create_public_order<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    _create_order(program_id, accounts, instruction_data, false)
}

fn create_private_order<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    _create_order(program_id, accounts, instruction_data, true)
}

fn close_order<'a>(
    _program_id: &'a Pubkey,
    _accounts: &'a [AccountInfo<'a>],
    _instruction_data: &[u8],
) -> ProgramResult {
    todo!()
}

fn _fill_order<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    sell_token_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let seller = next_account_info(account_info_iter)?; // 1 - seller pubkey
    let buyer = next_account_info(account_info_iter)?; // 2 - buyer pubkey
    let order_account = next_account_info(account_info_iter)?; // 3 - order pubkey
    let mut order = SwapSPLOrder::unpack(&order_account.data.borrow())?;

    if order.is_private {
        let sysvar_instructions = next_account_info(account_info_iter)?; // 4 -sysvar instruction
        if !sysvar::instructions::check_id(sysvar_instructions.key) {
            msg!(
                "Sysvar instructions account not match. Expected: {:?}",
                sysvar::instructions::id(),
            );
            return Err(ProgramError::InvalidAccountData);
        }

        let ed25519_instr =
            sysvar::instructions::get_instruction_relative(
                -1,
                sysvar_instructions
            )?;

        if !solana_program::ed25519_program::check_id(&ed25519_instr.program_id) {
            msg!("Previous instruction should be for ed25519_program");
            return Err(ProgramError::InvalidAccountData);
        }

        let ed25519_data = array_ref![&ed25519_instr.data, 0, 144];
        let (_, unlock_signer, _, unlock_order) = array_refs![ed25519_data, 16, 32, 64, 32];

        let unlock_signer = Pubkey::new_from_array(*unlock_signer);
        if unlock_signer != order.seller {
            msg!("ed25519 instruction is invalid: wrong seller");
            return Err(ProgramError::InvalidAccountData);
        }

        let unlock_order = Pubkey::new_from_array(*unlock_order);
        if unlock_order != *order_account.key {
            msg!("ed25519 instruction is invalid: wrong order");
            return Err(ProgramError::InvalidAccountData);
        }
    }

    if order.seller != *seller.key {
        msg!("Seller does not match: {:?}", order.seller);
        return Err(ProgramError::InvalidAccountData);
    }

    if order.min_sell_amount > sell_token_amount {
        msg!("Buy amount is below minimum");
        return Err(ProgramError::Custom(1));
    }

    if order.remains_to_fill < sell_token_amount {
        msg!("Order has not enough tokens");
        return Err(ProgramError::Custom(1));
    }

    let (expected_order_wallet_authority, bump_seed) = get_order_wallet_authority(program_id, seller.key);
    let order_wallet_authority = next_account_info(account_info_iter)?; // 5 - order wallet authority
    if expected_order_wallet_authority != *order_wallet_authority.key {
        msg!(
            "Order wallet authority not match. Excpected {:?}",
            expected_order_wallet_authority,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let sell_token = next_account_info(account_info_iter)?; // 6 - sell token mint

    let expected_order_wallet = get_order_wallet_address(
        sell_token.key,
        order_wallet_authority.key
    );
    let order_wallet_accinfo = next_account_info(account_info_iter)?; // 7 - order wallet
    if expected_order_wallet != *order_wallet_accinfo.key || order.order_wallet != *order_wallet_accinfo.key {
        msg!("Order wallet not match. Expected: {:?}", order.order_wallet);
        return Err(ProgramError::InvalidAccountData);
    }

    let order_wallet = SPLAccount::unpack(&order_wallet_accinfo.data.borrow())?;

    if order_wallet.mint != *sell_token.key {
        msg!("Sell token not match. Expected: {:?}", order_wallet.mint);
        return Err(ProgramError::InvalidAccountData);
    }

    let buy_token = next_account_info(account_info_iter)?; // 8 - buy token mint
    if order.price_mint != *buy_token.key {
        msg!("Buy token not match. Expected: {:?}", order.price_mint);
        return Err(ProgramError::InvalidAccountData);
    }

    let buyer_buy_token_wallet_address =
        spl_associated_token_account::get_associated_token_address(
            buyer.key,
            buy_token.key
        );
    let buyer_buy_token_wallet = next_account_info(account_info_iter)?; // 9 - buyer buy token wallet
    if buyer_buy_token_wallet_address != *buyer_buy_token_wallet.key {
        msg!("Buyer buy token wallet not match. Expected: {:?}", buyer_buy_token_wallet_address);
        return Err(ProgramError::InvalidAccountData);
    }

    let seller_buy_token_wallet_address =
        spl_associated_token_account::get_associated_token_address(
            seller.key,
            buy_token.key
        );
    let seller_buy_token_wallet = next_account_info(account_info_iter)?; // 10 - seller buy token wallet
    if seller_buy_token_wallet_address != *seller_buy_token_wallet.key {
        msg!("Seller buy token wallet not match. Expected: {:?}", seller_buy_token_wallet_address);
        return Err(ProgramError::InvalidAccountData);
    }

    let buyer_sell_token_wallet_address =
        spl_associated_token_account::get_associated_token_address(
            buyer.key,
            sell_token.key
        );
    let buyer_sell_token_wallet = next_account_info(account_info_iter)?; // 11 - buyer sell token wallet
    if buyer_sell_token_wallet_address != *buyer_sell_token_wallet.key {
        msg!("Buyer sell token wallet not match. Expected: {:?}", buyer_sell_token_wallet_address);
        return Err(ProgramError::InvalidAccountData);
    }

    let token_program = next_account_info(account_info_iter)?; // 12 - token program
    if !spl_token::check_id(token_program.key) {
        msg!("Token program not match: {:?}", token_program.key);
        return Err(ProgramError::InvalidAccountData);
    }

    let buy_token_amount = (sell_token_amount * order.buy_amount) / order.sell_amount;

    let tfer_inst = spl_token::instruction::transfer(
        &spl_token::id(),
        order_wallet_accinfo.key,
        buyer_sell_token_wallet.key,
        order_wallet_authority.key,
        &[],
        sell_token_amount,
    )?;

    invoke_signed(
        &tfer_inst,
        &[
            order_wallet_accinfo.clone(),
            buyer_sell_token_wallet.clone(),
            order_wallet_authority.clone(),
        ],
        &[&[b"OrderWalletAuthority", &seller.key.to_bytes(), &[bump_seed]]],
    )?;

    let tfer_inst = spl_token::instruction::transfer(
        &spl_token::id(),
        buyer_buy_token_wallet.key,
        seller_buy_token_wallet.key,
        buyer.key,
        &[],
        buy_token_amount,
    )?;

    invoke_signed(
        &tfer_inst,
        &[
            buyer_buy_token_wallet.clone(),
            seller_buy_token_wallet.clone(),
            buyer.clone(),
        ],
        &[],
    )?;

    order.remains_to_fill -= sell_token_amount;
    SwapSPLOrder::pack(order, order_account.data.borrow_mut().deref_mut())
}

fn fill_order<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let sell_token_amount = if instruction_data.len() == 8 {
        let sell_token_amount = array_ref![instruction_data, 0, 8];
        u64::from_le_bytes(*sell_token_amount)
    } else {
        msg!(
            "Invalid data - expected 8 bytes - {:?}",
            instruction_data,
        );
        return Err(ProgramError::InvalidInstructionData);
    };

    _fill_order(program_id, accounts, sell_token_amount)
}

fn fill_private_order<'a>(
    _program_id: &'a Pubkey,
    _accounts: &'a [AccountInfo<'a>],
    _instruction_data: &[u8],
) -> ProgramResult {
    todo!()
}

fn process_instruction<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let (tag, instruction) = instruction_data.split_first().ok_or_else(|| {
        msg!("Invalid instruction - {:?}", instruction_data);
        ProgramError::InvalidInstructionData
    })?;

    let tag = P2PSwapInstructions::from_u8(*tag);

    match tag {
        P2PSwapInstructions::Undefined => {
            msg!("Invalid instruction tag");
            Err(ProgramError::InvalidInstructionData)
        }
        P2PSwapInstructions::CreatePublicOrder => create_public_order(program_id, accounts, instruction),
        P2PSwapInstructions::CreatePrivateOrder => create_private_order(program_id, accounts, instruction),
        P2PSwapInstructions::CloseOrder => close_order(program_id, accounts, instruction),
        P2PSwapInstructions::FillOrder => fill_order(program_id, accounts, instruction),
        P2PSwapInstructions::FillPrivateOrder => fill_private_order(program_id, accounts, instruction),
    }
}
