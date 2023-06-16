import {
    Connection,
    PublicKey,
    SystemProgram,
    SYSVAR_CLOCK_PUBKEY,
    Transaction,
    TransactionInstruction
} from "@solana/web3.js"
import {
    getAssociatedTokenAddressSync,
    getAccount as getSPLAccount,
    Mint as TokenMint,
    getMint as getTokenMint, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createApproveInstruction,
} from "@solana/spl-token"

interface OrderDescriptionData {
    creationSlot: bigint,
    seller: PublicKey,
    sellAmount: bigint,
    orderWallet: PublicKey,
    priceMint: PublicKey,
    buyAmount: bigint,
    minSellAmount: bigint,
    remainsToFill: bigint,
    isPrivate: boolean,
    sellToken: TokenMint,
    buyToken: TokenMint,
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
    if (data.length != 137) {
        throw "Account is not p2p order";
    }

    let view = new DataView(data.slice(0, 137).buffer, 0);
    let creationSlot = view.getBigUint64(0, true);
    let seller = new PublicKey(data.slice(8, 40));
    let sellAmount = view.getBigUint64(40, true);
    let orderWallet = new PublicKey(data.slice(48, 80));
    let priceMint = new PublicKey(data.slice(80, 112));
    let buyAmount = view.getBigUint64(112, true);
    let minSellAmount = view.getBigUint64(120, true);
    let remainsToFill = view.getBigUint64(128, true);
    let isPrivate = view.getUint8(136) == 0 ? false : true;

    let orderWalletAccount = await getSPLAccount(connection, orderWallet);
    let sellToken = await getTokenMint(connection, orderWalletAccount.mint);
    let buyToken = await getTokenMint(connection, priceMint);

    return {
        "creationSlot": creationSlot,
        "seller": seller,
        "sellAmount": sellAmount,
        "orderWallet": orderWallet,
        "priceMint": priceMint,
        "buyAmount": buyAmount,
        "minSellAmount": minSellAmount,
        "remainsToFill": remainsToFill,
        "isPrivate": isPrivate,
        "sellToken": sellToken,
        "buyToken": buyToken,
    };
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

const P2P_SWAP_DEVNET = new PublicKey("AzVuKVf8qQjHBTyjEUZbr6zRvinZvjpuFZWMXPd76Fzx");

export {
    type OrderDescriptionData,
    type CreateOrderProps,
    getOrderDescription,
    getOrderDescriptionChecked,
    publicKeyChecker,
    bigintChecker,
    checkOrder,
    createOrderInstruction,
    createOrderTransaction,
    P2P_SWAP_DEVNET,
}