import {Connection, PublicKey} from "@solana/web3.js"
import {
    getAssociatedTokenAddressSync,
    getAccount as getSPLAccount,
    Mint as TokenMint,
    getMint as getTokenMint,
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

export {
    type OrderDescriptionData,
    getOrderDescription,
    getOrderDescriptionChecked,
    publicKeyChecker,
    checkOrder,
}