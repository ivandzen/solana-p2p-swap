use {
    crate::{
        SwapSPLOrder,
        get_order_wallet_address,
        get_order_address,
        get_order_wallet_authority,
        P2PSwapInstructions,
        P2PSwapError,
    },
    arrayref::{array_ref, array_refs},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        clock::Slot,
        entrypoint,
        entrypoint::ProgramResult,
        msg,
        program::invoke_signed,
        program_error::ProgramError,
        program_memory::sol_memset,
        program_pack::Pack,
        pubkey::Pubkey,
        rent::Rent,
        system_instruction, system_program,
        sysvar::{self, Sysvar},
    },
    spl_token::state::Account as SPLAccount,
    spl_associated_token_account::get_associated_token_address,
    std::ops::DerefMut,
};

entrypoint!(process_instruction);

// Latest slot number is used as seed to generate order accounts
// This constant prevents seed to bee too far in past
const MAX_SLOT_DIFFERENCE: Slot = 150;

fn create_order_account<'a>(
    system_account: &AccountInfo<'a>,
    program_id: &Pubkey,
    seller: &AccountInfo<'a>,
    order_account: &AccountInfo<'a>,
    creation_slot: u64,
    bump_seed: u8,
) -> Result<(), ProgramError> {
    let rent = Rent::get()?;
    let minimum_balance = rent.minimum_balance(SwapSPLOrder::LEN).max(1);

    if order_account.lamports() > 0 {
        msg!("Order {:?} already exists", order_account.key);
        return Err(ProgramError::Custom(P2PSwapError::OrderExists as u32));
    } else {
        invoke_signed(
            &system_instruction::create_account(
                seller.key,
                order_account.key,
                minimum_balance,
                SwapSPLOrder::LEN as u64,
                program_id,
            ),
            &[
                (*seller).clone(),
                order_account.clone(),
                system_account.clone(),
            ],
            &[&[
                b"OrderAccount",
                &seller.key.to_bytes(),
                &creation_slot.to_le_bytes(),
                &[bump_seed],
            ]],
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

    let (sell_amount, buy_amount, min_sell_amount, creation_slot) = if instruction_data.len() == 32 {
        let instruction_data = array_ref![instruction_data, 0, 32];
        let (sell_amount, buy_amount, min_sell_amount, creation_slot)
            = array_refs![instruction_data, 8, 8, 8, 8];
        (
            u64::from_le_bytes(*sell_amount),
            u64::from_le_bytes(*buy_amount),
            u64::from_le_bytes(*min_sell_amount),
            u64::from_le_bytes(*creation_slot),
        )
    } else {
        msg!(
            "Invalid data - expected 32 bytes - {:?}",
            instruction_data,
        );
        return Err(ProgramError::InvalidInstructionData);
    };

    let clock = next_account_info(account_info_iter)?; // 1 - clock account
    if !sysvar::clock::check_id(clock.key) {
        msg!("Clock not match");
        return Err(ProgramError::InvalidAccountData);
    }

    let clock = sysvar::clock::Clock::from_account_info(clock)?;
    let newest_slot = clock.slot;
    if creation_slot > newest_slot || newest_slot - creation_slot > MAX_SLOT_DIFFERENCE {
        msg!(
            "creation slot {:?} is too far from current {:?}. Please, generate new order account with latest slot number as seed",
            creation_slot,
            newest_slot,
        );
        return Err(ProgramError::Custom(P2PSwapError::CreationSlotToFar as u32));
    }

    let seller = next_account_info(account_info_iter)?; // 2 - seller Pubkey

    let seller_token_account_info = next_account_info(account_info_iter)?; // 3 - seller token account
    let seller_token_account = SPLAccount::unpack(&seller_token_account_info.data.borrow())?;
    if seller_token_account.owner != *seller.key {
        msg!("Token account owner not match. Expected {:?}", seller.key,);
        return Err(ProgramError::InvalidAccountData);
    }

    let sell_token_mint = next_account_info(account_info_iter)?; // 4 - selling token mint
    if seller_token_account.mint != *sell_token_mint.key {
        msg!(
            "Token mint not match. Expected {:?}",
            seller_token_account.mint,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let (expected_order_wallet_authority, bump_seed) = get_order_wallet_authority(program_id, seller.key);
    let order_wallet_authority = next_account_info(account_info_iter)?; // 5 - order wallet authority
    if expected_order_wallet_authority != *order_wallet_authority.key {
        msg!(
            "Order wallet authority not match. Expected {:?}",
            expected_order_wallet_authority,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let buy_token_mint = next_account_info(account_info_iter)?; // 6 - buy token mint

    let order_wallet = next_account_info(account_info_iter)?; // 7 - order wallet address
    let expected_order_wallet = get_order_wallet_address(
        sell_token_mint.key,
        order_wallet_authority.key,
    );

    if expected_order_wallet != *order_wallet.key {
        msg!(
            "Order walled not match. Expected {:?}",
            expected_order_wallet,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let token_program = next_account_info(account_info_iter)?; // 8 - token_program
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

    let order_account = next_account_info(account_info_iter)?; // 9 - order account
    let (expected_order_account, bump_seed) =
        get_order_address(program_id, seller.key, creation_slot);
    if expected_order_account != *order_account.key {
        msg!(
            "Order account not match. Expected {:?}",
            expected_order_account,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let system_account = next_account_info(account_info_iter)?; // 10 - system account
    if !system_program::check_id(system_account.key) {
        msg!("System program not match. Got {:?}", system_account.key,);
        return Err(ProgramError::InvalidAccountData);
    }

    create_order_account(
        system_account,
        program_id,
        seller,
        order_account,
        creation_slot,
        bump_seed,
    )?;

    let order = SwapSPLOrder {
        creation_slot,
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

fn check_and_get_order(
    program_id: &Pubkey,
    seller_account: &AccountInfo,
    order_account: &AccountInfo
) -> Result<(SwapSPLOrder, u8), ProgramError> {
    let order = SwapSPLOrder::unpack(&order_account.data.borrow())?;
    if order.seller != *seller_account.key {
        msg!(
                "Seller not match. Expected: {:?}",
                order.seller,
            );
        return Err(ProgramError::InvalidAccountData);
    }

    let (expected_order_account, bump_seed) = get_order_address(
        program_id,
        &order.seller,
        order.creation_slot
    );

    if expected_order_account != *order_account.key {
        msg!(
                "Order not match. Expected: {:?}",
                expected_order_account,
            );

        return Err(ProgramError::InvalidAccountData);
    }

    Ok((order, bump_seed))
}

fn check_and_get_order_wallet(
    program_id: &Pubkey,
    order: &SwapSPLOrder,
    order_wallet_authority: &AccountInfo,
    order_wallet_account: &AccountInfo,
) -> Result<(SPLAccount, u8), ProgramError> {
    let order_wallet = SPLAccount::unpack(&order_wallet_account.data.borrow())?;

    let (expected_order_wallet_authority, bump_seed) = get_order_wallet_authority(program_id, &order.seller);
    if expected_order_wallet_authority != *order_wallet_authority.key {
        msg!(
                "Order wallet authority not match. Expected: {:?}",
                expected_order_wallet_authority,
            );
        return Err(ProgramError::InvalidAccountData);
    }

    let expected_order_wallet = get_order_wallet_address(&order_wallet.mint, order_wallet_authority.key);
    if expected_order_wallet != *order_wallet_account.key {
        msg!(
                "Order wallet not match. Expected: {:?}",
                expected_order_wallet,
            );
        return Err(ProgramError::InvalidAccountData);
    }

    Ok((order_wallet, bump_seed))
}

fn revoke_order<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let caller = next_account_info(account_info_iter)?; // 0 - caller
    if !caller.is_signer {
        msg!("Caller must be signer");
        return Err(ProgramError::InvalidAccountData);
    }

    let seller = next_account_info(account_info_iter)?; // 1 - seller
    let order_account = next_account_info(account_info_iter)?; // 2 - order
    let (mut order, _) = check_and_get_order(program_id, seller, order_account)?;

    let order_wallet_authority = next_account_info(account_info_iter)?; // 3 - order wallet authority
    let order_wallet_account = next_account_info(account_info_iter)?; // 4 - order wallet

    let (order_wallet, bump_seed) = check_and_get_order_wallet(
        program_id,
        &order,
        order_wallet_authority,
        order_wallet_account,
    )?;

    let revoke_amount = if *caller.key != *seller.key {
        if order.remains_to_fill > order.min_sell_amount {
            // order still have enough tokens on the balance to make transactions
            // it can be closed only by owner (seller)
            msg!("Only seller can revoke unfinished orders");
            return Err(ProgramError::InvalidAccountData);
        }
        // order should be revoked entirely
        order.remains_to_fill
    } else {
        if instruction_data.len() != 8 {
            msg!("Instruction data expected to be 8 bytes long");
            return Err(ProgramError::InvalidInstructionData);
        }

        let instruction_data = array_ref![instruction_data, 0, 8];
        u64::from_le_bytes(*instruction_data)
    };

    if revoke_amount > order.remains_to_fill {
        msg!("Unable to revoke {:?} tokens", revoke_amount);
        return Err(ProgramError::InvalidInstructionData);
    }

    let revoke_amount = if revoke_amount == 0 {
        // this case only reached if caller == seller
        order.remains_to_fill
    } else {
        revoke_amount
    };

    let seller_wallet = next_account_info(account_info_iter)?; // 5 - seller wallet address
    let expected_seller_wallet = get_associated_token_address(seller.key, &order_wallet.mint);
    if expected_seller_wallet != *seller_wallet.key {
        msg!(
            "Seller wallet not match. Expected {:?}",
            expected_seller_wallet,
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let token_program = next_account_info(account_info_iter)?; // 6 - token program
    if !spl_token::check_id(token_program.key) {
        msg!(
            "Token program not match. Expected {:?}",
            spl_token::id(),
        );
        return Err(ProgramError::InvalidAccountData);
    }

    let remains_to_fill_after = order.remains_to_fill
        .checked_sub(revoke_amount)
        .ok_or(ProgramError::InvalidInstructionData)?;

    let tfer_inst = spl_token::instruction::transfer(
        &spl_token::id(),
        order_wallet_account.key,
        seller_wallet.key,
        order_wallet_authority.key,
        &[],
        revoke_amount,
    )?;

    invoke_signed(
        &tfer_inst,
        &[
            order_wallet_account.clone(),
            seller_wallet.clone(),
            order_wallet_authority.clone(),
        ],
        &[&[b"OrderWalletAuthority", &caller.key.to_bytes(), &[bump_seed]]],
    )?;

    if remains_to_fill_after == 0 {
        let caller_starting_lamports = caller.lamports();
        **caller.lamports.borrow_mut() = caller_starting_lamports
            .checked_add(order_account.lamports())
            .ok_or(ProgramError::InvalidInstructionData)?;

        **order_account.lamports.borrow_mut() = 0;

        sol_memset(*order_account.data.borrow_mut(), 0, SwapSPLOrder::LEN);

        Ok(())
    } else {
        order.remains_to_fill = remains_to_fill_after;
        SwapSPLOrder::pack(order, &mut order_account.data.borrow_mut())
    }
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
            return Err(ProgramError::Custom(P2PSwapError::UnlockInstructionNotFound as u32));
        }

        let ed25519_data = array_ref![&ed25519_instr.data, 0, 144];
        let (_, unlock_signer, _, unlock_order) = array_refs![ed25519_data, 16, 32, 64, 32];

        let unlock_signer = Pubkey::new_from_array(*unlock_signer);
        if unlock_signer != order.seller {
            msg!("ed25519 instruction is invalid: wrong seller");
            return Err(ProgramError::Custom(P2PSwapError::UnlockInstructionInvalid as u32));
        }

        let unlock_order = Pubkey::new_from_array(*unlock_order);
        if unlock_order != *order_account.key {
            msg!("ed25519 instruction is invalid: wrong order");
            return Err(ProgramError::Custom(P2PSwapError::UnlockInstructionInvalid as u32));
        }
    }

    if order.seller != *seller.key {
        msg!("Seller does not match: {:?}", order.seller);
        return Err(ProgramError::InvalidAccountData);
    }

    if order.min_sell_amount > sell_token_amount {
        msg!("Buy amount is below minimum");
        return Err(ProgramError::Custom(P2PSwapError::BuyAmountBelowMinimum as u32));
    }

    if order.remains_to_fill < sell_token_amount {
        msg!("Order has not enough tokens");
        return Err(ProgramError::Custom(P2PSwapError::NotEnoughTokensInOrder as u32));
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
        get_associated_token_address(
            buyer.key,
            buy_token.key
        );
    let buyer_buy_token_wallet = next_account_info(account_info_iter)?; // 9 - buyer buy token wallet
    if buyer_buy_token_wallet_address != *buyer_buy_token_wallet.key {
        msg!("Buyer buy token wallet not match. Expected: {:?}", buyer_buy_token_wallet_address);
        return Err(ProgramError::InvalidAccountData);
    }

    let seller_buy_token_wallet_address =
        get_associated_token_address(
            seller.key,
            buy_token.key
        );
    let seller_buy_token_wallet = next_account_info(account_info_iter)?; // 10 - seller buy token wallet
    if seller_buy_token_wallet_address != *seller_buy_token_wallet.key {
        msg!("Seller buy token wallet not match. Expected: {:?}", seller_buy_token_wallet_address);
        return Err(ProgramError::InvalidAccountData);
    }

    let buyer_sell_token_wallet_address =
        get_associated_token_address(
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
        P2PSwapInstructions::RevokeOrder => revoke_order(program_id, accounts, instruction),
        P2PSwapInstructions::FillOrder => fill_order(program_id, accounts, instruction),
    }
}
