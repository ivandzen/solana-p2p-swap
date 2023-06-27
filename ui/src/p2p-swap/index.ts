import {
    AccountMeta,
    Connection, Ed25519Program, ParsedAccountData,
    PublicKey,
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY, SYSVAR_INSTRUCTIONS_PUBKEY,
    Transaction,
    TransactionInstruction
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    getAccount as getSPLAccount,
    Mint as TokenMint,
    getMint as getTokenMint,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    createApproveInstruction,
    getAssociatedTokenAddress
} from "@solana/spl-token";
import { WalletError } from "@solana/wallet-adapter-base";
import Decimal from "decimal.js";
const base58 = require('base58-js');

interface OrderDescriptionData {
    creationSlot: bigint,
    seller: PublicKey,
    sellAmount: bigint,
    orderWallet: PublicKey,
    tokenMint: PublicKey,
    priceMint: PublicKey,
    buyAmount: bigint,
    minSellAmount: bigint,
    remainsToFill: bigint,
    isPrivate: boolean,
    sellToken?: TokenMint,
    buyToken?: TokenMint,
}

const ORDER_ACCOUNT_SIZE = 169;

function parseOrderDescription(
    data: Buffer
): OrderDescriptionData {
    if (data.length != ORDER_ACCOUNT_SIZE) {
        throw "Account is not p2p order";
    }

    let view = new DataView(data.slice(0, ORDER_ACCOUNT_SIZE).buffer, 0);
    let creationSlot = view.getBigUint64(0, true);
    let seller = new PublicKey(data.slice(8, 40));
    let sellAmount = view.getBigUint64(40, true);
    let orderWallet = new PublicKey(data.slice(48, 80));
    let tokenMint = new PublicKey(data.slice(80, 112));
    let priceMint = new PublicKey(data.slice(112, 144));
    let buyAmount = view.getBigUint64(144, true);
    let minSellAmount = view.getBigUint64(152, true);
    let remainsToFill = view.getBigUint64(160, true);
    let isPrivate = view.getUint8(168) != 0;

    return {
        creationSlot: creationSlot,
        seller: seller,
        sellAmount: sellAmount,
        orderWallet: orderWallet,
        tokenMint: tokenMint,
        priceMint: priceMint,
        buyAmount: buyAmount,
        minSellAmount: minSellAmount,
        remainsToFill: remainsToFill,
        isPrivate: isPrivate,
    };
}

export function amountToDecimal(value: bigint, decimals: number): Decimal {
    return new Decimal(value.toString()).div(new Decimal(10).pow(new Decimal(decimals)));
}

export function amountToStr(value: bigint, decimals: number): string {
    return amountToDecimal(value, decimals).toString();
}

async function getOrderDescription(
    connection: Connection,
    orderAddress: PublicKey
): Promise<OrderDescriptionData> {
    const orderData = await connection.getAccountInfo(orderAddress);
    if (!orderData) {
        throw "Order not found";
    }

    let data = orderData.data;
    let order = parseOrderDescription(data);
    let orderWalletAccount = await getSPLAccount(connection, order.orderWallet);
    let sellToken = await getTokenMint(connection, orderWalletAccount.mint);
    let buyToken = await getTokenMint(connection, order.priceMint);
    order.sellToken = sellToken;
    order.buyToken = buyToken;

    return order;
}

function int64ToBytes(value: bigint): ArrayBuffer {
    const arrayBuffer = new ArrayBuffer(8);
    const dataView = new DataView(arrayBuffer);
    dataView.setBigUint64(0, value, true);
    return arrayBuffer;
}

function int8ToBytes(value: number): ArrayBuffer {
    const arrayBuffer = new ArrayBuffer(1);
    const dataView = new DataView(arrayBuffer);
    dataView.setInt8(0, value);
    return arrayBuffer;
}

function getOrderWalletAuthority(programId: PublicKey, seller: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("OrderWalletAuthority"), seller.toBytes()],
        programId
    )
}

function getOrderWalletAddress(sellTokenMint: PublicKey, authority: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(sellTokenMint, authority, true);
}

function getOrderAddress(
    programId: PublicKey,
    seller: PublicKey,
    creationSlot: bigint
): [PublicKey, number] {
    let prefix = Buffer.from("OrderAccount", "utf-8");
    let sellerBytes = seller.toBytes();
    let creationSlotBytes = Buffer.from(int64ToBytes(creationSlot));
    return PublicKey.findProgramAddressSync(
        [prefix, sellerBytes, creationSlotBytes],
        programId
    );
}

async function checkOrder(
    programId: PublicKey,
    order: &OrderDescriptionData,
    orderAddress: PublicKey|null,
    seller: PublicKey|null = null
): Promise<string|null> {
    if (seller) {
        if (order.seller != seller) {
            return "Seller not match";
        }
    }


    if (orderAddress) {
        let [expectedOrderAddress, _] = getOrderAddress(programId, order.seller, order.creationSlot);
        if (!expectedOrderAddress.equals(orderAddress)) {
            return `Order address not match. Expected: ${expectedOrderAddress}`;
        }
    }

    if (!order.sellToken) {
        return "sellToken not set";
    }

    let [authority, _] = getOrderWalletAuthority(programId, order.seller);
    let expectedOrderWallet = getOrderWalletAddress(order.sellToken.address, authority);
    if (!expectedOrderWallet.equals(order.orderWallet)) {
        return "Order wallet not match";
    }

    return null;
}

function publicKeyChecker(value: string|null|undefined): boolean {
    if (!value) {
        return false;
    }

    try {
        new PublicKey(value);
        return true;
    } catch (e) {
        return false;
    }
}

function parseUnlockKey(value: string|null|undefined): Uint8Array|null {
    if (!value) {
        return null;
    }

    try {
        let binForm = base58.base58_to_binary(value);
        if (binForm.length != 64) {
            return null;
        }

        return binForm;
    } catch (e) {
        return null;
    }
}

function unlockKeyChecker(value: string|null|undefined): boolean {
    return parseUnlockKey(value) !== null;
}

function bigintChecker(value: string|null|undefined): boolean {
    try {
        if (!value) {
            return false;
        }
        BigInt(value);
    } catch (e) {
        return false
    }

    return true;
}

function parseBigInt(value: string|null|undefined): bigint|null {
    try {
        if (!value) {
            return null;
        }
        return BigInt(value);
    } catch (e) {}

    return null;
}

async function getOrderDescriptionChecked(
    connection: Connection,
    orderAddress: PublicKey,
    programId: PublicKey,
): Promise<OrderDescriptionData> {
    let order = await getOrderDescription(connection, orderAddress);
    let checkErr = await checkOrder(programId, order, orderAddress);
    if (checkErr) {
        throw checkErr;
    }

    return order;
}

enum P2PSwapInstructions {
    Undefined = 0,
    CreatePublicOrder = 1,
    CreatePrivateOrder = 2,
    RevokeOrder = 3,
    FillOrder = 4,
}

interface CreateOrderProps {
    programId: PublicKey,
    sellAmount: bigint,
    buyAmount: bigint,
    minSellAmount: bigint,
    creationSlot: bigint,
    signer: PublicKey,
    sellToken: PublicKey,
    buyToken: PublicKey,
    isPrivate: boolean,
    orderWalletAuthority?: PublicKey,
    orderWallet?: PublicKey,
    orderAddress?: PublicKey,
}

function createOrderInstruction(props: CreateOrderProps): TransactionInstruction {
    let signerWallet = getAssociatedTokenAddressSync(props.sellToken, props.signer, false);
    let [orderWalletAuthority] =
        props.orderWalletAuthority
        ? [props.orderWalletAuthority]
        : getOrderWalletAuthority(props.programId, props.signer);

    let orderWallet =
        props.orderWallet
        ? props.orderWallet
        : getOrderWalletAddress(props.sellToken, orderWalletAuthority);

    let [orderAccount] =
        props.orderAddress
        ? [props.orderAddress]
        : getOrderAddress(props.programId, props.signer, props.creationSlot);

    let keys = [
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: props.signer, isSigner: true, isWritable: true },
        { pubkey: signerWallet, isSigner: false, isWritable: true },
        { pubkey: props.sellToken, isSigner: false, isWritable: false },
        { pubkey: orderWalletAuthority, isSigner: false, isWritable: false },
        { pubkey: props.buyToken, isSigner: false, isWritable: false },
        { pubkey: orderWallet, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: orderAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    let data = Buffer.concat([
        Buffer.from(int8ToBytes(
            props.isPrivate
            ? P2PSwapInstructions.CreatePrivateOrder
            : P2PSwapInstructions.CreatePublicOrder
        )),
        Buffer.from(int64ToBytes(props.sellAmount)),
        Buffer.from(int64ToBytes(props.buyAmount)),
        Buffer.from(int64ToBytes(props.minSellAmount)),
        Buffer.from(int64ToBytes(props.creationSlot)),
    ]);

    return new TransactionInstruction({
        keys: keys,
        programId: props.programId,
        data: data
    });
}

async function createOrderTransaction(
    connection: Connection,
    props: CreateOrderProps,
): Promise<[Transaction, PublicKey]> {
    let [orderWalletAuthority] = getOrderWalletAuthority(props.programId, props.signer);
    let orderWallet = getOrderWalletAddress(props.sellToken, orderWalletAuthority);
    let [orderAccount] = getOrderAddress(props.programId, props.signer, props.creationSlot);
    let createWalletInstruction: TransactionInstruction|null = null;

    if (!await connection.getAccountInfo(orderWallet)) {
        // order wallet does not exist
        createWalletInstruction =
            createAssociatedTokenAccountInstruction(
                props.signer,
                orderWallet,
                orderWalletAuthority,
                props.sellToken
            );
    }

    const { blockhash } = await connection.getLatestBlockhash();
    let transaction = new Transaction({ recentBlockhash: blockhash, feePayer: props.signer });
    if (createWalletInstruction) {
        transaction.add(createWalletInstruction);
    }

    let sellerWallet = getAssociatedTokenAddressSync(props.sellToken, props.signer, false);
    transaction.add(
        createApproveInstruction(
            sellerWallet,
            props.programId,
            props.signer,
            props.sellAmount
        ));

    transaction.add(createOrderInstruction(props));

    return [transaction, orderAccount];
}

interface FillOrderProps {
    signer: PublicKey,
    programId: PublicKey,
    sellTokenAmount: bigint,
    orderAddress: PublicKey,
    order: OrderDescriptionData,
    unlockKey?: Uint8Array,
    buyerBuyTokenWallet?: PublicKey,
}

async function createFillInstruction(props: FillOrderProps): Promise<TransactionInstruction> {
    if (!props.buyerBuyTokenWallet) {
        throw "Buyer buy token wallet is not set";
    }

    if (!props.order.sellToken) {
        throw "Sell token is not set in order";
    }

    if (!props.order.buyToken) {
        throw "Buy token is not set in order";
    }

    let keys: AccountMeta[] = [
        { pubkey: props.order.seller, isSigner: false, isWritable: false },
        { pubkey: props.signer, isSigner: true, isWritable: true },
        { pubkey: props.orderAddress, isSigner: false, isWritable: true },
    ];

    if (props.order.isPrivate) {
        keys.push({ pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false });
    }

    let [orderWalletAuthority] = getOrderWalletAuthority(props.programId, props.order.seller);

    let sellerBuyTokenWallet
      = await getAssociatedTokenAddress(props.order.buyToken.address, props.order.seller, false);

    let buyerSellTokenWallet =
        await getAssociatedTokenAddress(props.order.sellToken.address, props.signer, false);

    keys.push(
      { pubkey: orderWalletAuthority, isSigner: false, isWritable: false },
      { pubkey: props.order.sellToken.address, isSigner: false, isWritable: false },
      { pubkey: props.order.orderWallet, isSigner: false, isWritable: true },
      { pubkey: props.order.buyToken.address, isSigner: false, isWritable: false },
      { pubkey: props.buyerBuyTokenWallet, isSigner: false, isWritable: true },
      { pubkey: sellerBuyTokenWallet, isSigner: false, isWritable: true },
      { pubkey: buyerSellTokenWallet, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    )

    let data: Buffer = Buffer.concat([
        Buffer.from(int8ToBytes(P2PSwapInstructions.FillOrder)),
        Buffer.from(int64ToBytes(props.sellTokenAmount)),
    ]);

    return new TransactionInstruction({
        keys: keys,
        programId: props.programId,
        data: data
    });
}

async function fillOrderTransaction(
  connection: Connection,
  props: FillOrderProps,
): Promise<Transaction> {
    const { blockhash } = await connection.getLatestBlockhash();
    let transaction = new Transaction({ recentBlockhash: blockhash, feePayer: props.signer });

    if (!props.order.buyToken) {
        throw "Buy token is not set in order";
    }

    props.buyerBuyTokenWallet = await getAssociatedTokenAddress(
      props.order.buyToken.address,
      props.signer,
      false
    );

    let buyTokenAmount = (props.sellTokenAmount * props.order.buyAmount) / props.order.sellAmount;

    // Allow p2p-swap program to transfer funds from signer's token account
    transaction.add(
      createApproveInstruction(
        props.buyerBuyTokenWallet,
        props.programId,
        props.signer,
        buyTokenAmount,
      ));

    if (props.order.isPrivate) {
        if (!props.unlockKey) {
            throw "Unlock key is not specified for private order";
        }

        transaction.add(Ed25519Program.createInstructionWithPublicKey({
            publicKey: props.order.seller.toBytes(),
            message: props.orderAddress.toBytes(),
            signature: props.unlockKey,
        }));
    }

    transaction.add(await createFillInstruction(props));

    return transaction;
}

interface WalletToken {
    label?: string,
    isNative: boolean,
    mint: PublicKey,
    owner: PublicKey,
    state: string,
    tokenAmount: bigint,
    decimals: number,
    uiAmount: number
}

async function getTokens(
    connection:Connection,
    owner: PublicKey,
    supportedTokens: Map<string, PublicKey>
): Promise<Map<string, WalletToken>> {
    console.log("Reading tokens...");
    let accounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        {
            programId: TOKEN_PROGRAM_ID
        });

    if (accounts.value) {
        let result: Map<string, WalletToken> = new Map();
        for (let key in accounts.value) {
            let entry = accounts.value[key].account.data.parsed.info;
            let mint = new PublicKey(entry.mint);
            const getLabel = (mint: PublicKey) => {
                for (let [label, address] of supportedTokens) {
                    if (address.toBase58() == mint.toBase58()) {
                        return label;
                    }
                }

                return undefined;
            };

            let label = getLabel(mint);
            if (label) {
                result.set(
                    label,
                    {
                        label: label,
                        isNative: entry.isNative,
                        mint: mint,
                        owner: new PublicKey(entry.owner),
                        state: entry.state,
                        tokenAmount: BigInt(entry.tokenAmount.amount),
                        decimals: entry.tokenAmount.decimals,
                        uiAmount: parseInt(entry.tokenAmount.uiAmount)
                    });
            } else {
                result.set(
                    mint.toBase58(),
                    {
                        label: undefined,
                        isNative: entry.isNative,
                        mint: mint,
                        owner: new PublicKey(entry.owner),
                        state: entry.state,
                        tokenAmount: BigInt(entry.tokenAmount.amount),
                        decimals: entry.tokenAmount.decimals,
                        uiAmount: parseInt(entry.tokenAmount.uiAmount)
                    });
            }

        }
        console.log(`Tokens: ${result}`);
        return result;
    }

    return new Map();
}

const P2P_SWAP_DEVNET = new PublicKey("AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx");

export {
    ORDER_ACCOUNT_SIZE,
    type OrderDescriptionData,
    type CreateOrderProps,
    type FillOrderProps,
    type WalletToken,
    parseOrderDescription,
    getOrderDescription,
    getOrderDescriptionChecked,
    publicKeyChecker,
    unlockKeyChecker,
    parseUnlockKey,
    bigintChecker,
    parseBigInt,
    checkOrder,
    createOrderInstruction,
    createOrderTransaction,
    fillOrderTransaction,
    getTokens,
    P2P_SWAP_DEVNET,
}