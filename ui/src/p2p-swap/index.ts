import {Connection, PublicKey} from "@solana/web3.js"
import {getAssociatedTokenAddressSync} from "@solana/spl-token"

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
}
async function getOrderDescription(
    connection: Connection,
    orderAddress: PublicKey
): Promise<OrderDescriptionData | null> {
    const orderData = await connection.getAccountInfo(orderAddress);
    if (!orderData) {
        return null;
    }

    let data = orderData.data;
    if (data.length != 137) {
        return null;
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

    return {
        "creationSlot": creationSlot,
        "seller": seller,
        "sellAmount": sellAmount,
        "orderWallet": orderWallet,
        "priceMint": priceMint,
        "buyAmount": buyAmount,
        "minSellAmount": minSellAmount,
        "remainsToFill": remainsToFill,
        "isPrivate": isPrivate
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

function getOrderAddress(programId: PublicKey, seller: PublicKey, creationSlot: bigint): [PublicKey, number] {
    let prefix = Buffer.from("OrderAccount", "utf-8");
    let sellerBytes = seller.toBytes();
    let creationSlotBytes = Buffer.from(int64ToBytes(creationSlot));
    return PublicKey.findProgramAddressSync(
        [prefix, sellerBytes, creationSlotBytes],
        programId
    );
}

function checkOrder(
    programId: PublicKey,
    order: &OrderDescriptionData,
    seller: PublicKey|null = null
): boolean {
    if (seller && order.seller !== seller) {
        return false
    }

    return false;
}

export { type OrderDescriptionData, getOrderDescription }