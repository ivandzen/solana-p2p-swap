import {Connection, PublicKey} from "@solana/web3.js"

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
    const orderData = await connection.getParsedAccountInfo(orderAddress);
    if (!orderData) {
        return null;
    }

    if (!orderData.value) {
        return null;
    }

    if (!orderData.value.data) {
        return null;
    }

    let data = orderData.value.data;
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

export { type OrderDescriptionData, getOrderDescription }