use {
    arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs},
};

#[cfg(not(feature="no-entrypoint"))]
use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

#[cfg(feature="no-entrypoint")]
use solana_sdk::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

//extern crate core;

#[cfg(not(feature="no-entrypoint"))]
#[macro_use]
pub mod entrypoint;

// Export current solana-sdk types for downstream users who may also be building with a different
// solana-sdk version
pub use solana_program;
use spl_associated_token_account::get_associated_token_address;

#[repr(C)]
#[derive(Debug)]
pub struct SwapSPLOrder {
    // creation slot
    pub creation_slot: u64,
    // Who is going to sell tokens
    pub seller: Pubkey,
    // How much tokens are allowed to be sold from order wallet within this order
    pub sell_amount: u64,
    // SPL wallet where tokens are stored. Every seller has dedicated order wallet for every
    // token he sells (all orders with the same token uses the same order wallet)
    pub order_wallet: Pubkey,
    // Token for payment (SOL if None)
    pub price_mint: Pubkey,
    // How much price-tokens seller wants to get
    pub buy_amount: u64,
    // Minimum amount of tokens to sell in a single fill transaction
    pub min_sell_amount: u64,
    // How much tokens are still to be sold
    pub remains_to_fill: u64,
    // Is this order private (key signed by seller required to unlock order)
    pub is_private: bool,
}

impl Sealed for SwapSPLOrder {}

impl IsInitialized for SwapSPLOrder {
    fn is_initialized(&self) -> bool {
        self.buy_amount != 0
    }
}

pub fn get_order_wallet_address(sell_token_mint: &Pubkey, authority: &Pubkey) -> Pubkey {
    get_associated_token_address(authority, sell_token_mint)
}

pub fn get_order_wallet_authority(program_id: &Pubkey, seller: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"OrderWalletAuthority", &seller.to_bytes()],
        program_id,
    )
}

pub fn get_order_address(program_id: &Pubkey, seller: &Pubkey, order_seed: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"OrderAccount",
            &seller.to_bytes(),
            &order_seed.to_le_bytes(),
        ],
        program_id,
    )
}

impl Pack for SwapSPLOrder {
    const LEN: usize = 137;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, 137];
        let (creation_slot, seller, sell_amount,
            order_wallet, price_mint, buy_amount,
            min_sell_amount, remains_to_fill, is_private) =
            array_refs![src, 8, 32, 8, 32, 32, 8, 8, 8, 1];

        let creation_slot = u64::from_le_bytes(*creation_slot);
        let sell_amount = u64::from_le_bytes(*sell_amount);
        let buy_amount = u64::from_le_bytes(*buy_amount);
        let min_sell_amount = u64::from_le_bytes(*min_sell_amount);
        let remains_to_fill = u64::from_le_bytes(*remains_to_fill);
        let is_private = match is_private {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };

        Ok(SwapSPLOrder {
            creation_slot,
            seller: Pubkey::new_from_array(*seller),
            sell_amount,
            order_wallet: Pubkey::new_from_array(*order_wallet),
            price_mint: Pubkey::new_from_array(*price_mint),
            buy_amount,
            min_sell_amount,
            remains_to_fill,
            is_private,
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, 137];
        let (
            creation_slot_dst,
            seller_dst,
            sell_amount_dst,
            order_wallet_dst,
            price_mint_dst,
            buy_amount_dst,
            min_sell_mount_dst,
            remains_to_fill_dst,
            is_private_dst,
        ) = mut_array_refs![dst, 8, 32, 8, 32, 32, 8, 8, 8, 1];
        let &SwapSPLOrder {
            creation_slot,
            ref seller,
            sell_amount,
            ref order_wallet,
            ref price_mint,
            buy_amount,
            min_sell_amount,
            remains_to_fill,
            is_private,
        } = self;
        *creation_slot_dst = creation_slot.to_le_bytes();
        seller_dst.copy_from_slice(seller.as_ref());
        *sell_amount_dst = sell_amount.to_le_bytes();
        order_wallet_dst.copy_from_slice(order_wallet.as_ref());
        price_mint_dst.copy_from_slice(price_mint.as_ref());
        *buy_amount_dst = buy_amount.to_le_bytes();
        *min_sell_mount_dst = min_sell_amount.to_le_bytes();
        *remains_to_fill_dst = remains_to_fill.to_le_bytes();
        is_private_dst[0] = is_private as u8;
    }
}

#[repr(u8)]
pub enum P2PSwapInstructions {
    Undefined = 0,
    CreatePublicOrder = 1,
    CreatePrivateOrder = 2,
    RevokeOrder = 3,
    FillOrder = 4,
}

impl P2PSwapInstructions {
    pub fn from_u8(value: u8) -> Self {
        match value {
            1 => P2PSwapInstructions::CreatePublicOrder,
            2 => P2PSwapInstructions::CreatePrivateOrder,
            3 => P2PSwapInstructions::RevokeOrder,
            4 => P2PSwapInstructions::FillOrder,
            _ => P2PSwapInstructions::Undefined,
        }
    }
}

enum P2PSwapError {
    OrderExists = 1,
    CreationSlotToFar = 2,
    UnlockInstructionNotFound = 3,
    UnlockInstructionInvalid = 4,
    BuyAmountBelowMinimum = 5,
    NotEnoughTokensInOrder = 6,
}