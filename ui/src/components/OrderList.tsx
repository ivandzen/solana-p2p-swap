import React, { FC, useEffect } from "react";
import { useApp } from "../AppContext";
import { Button } from "./Button";
import {
    ORDER_ACCOUNT_SIZE,
    OrderDescriptionData,
    P2P_SWAP_DEVNET,
    parseOrderDescription
} from "../p2p-swap";
import { PublicKey } from "@solana/web3.js";

interface OrderListProps {

}

const OrderList: FC<OrderListProps> = (props) => {
    const {orders, setOrders, connection} = useApp();

    const updateOrders = async () => {
        let accounts = await connection.getProgramAccounts(
            P2P_SWAP_DEVNET,
            {
                filters: [{dataSize: ORDER_ACCOUNT_SIZE}]
            })

        let orders = new Map<PublicKey, OrderDescriptionData>();
        for (let {account, pubkey} of accounts) {
            try {
                let order = parseOrderDescription(account.data);
                orders.set(pubkey, order);
            } catch (e) {
                console.log(`Failed to parse order ${pubkey}: ${e}`);
            }
        }

        console.log(orders);
        setOrders(orders);
    }

    useEffect(() => {
    }, [orders]);

    return (
        <div className="table-like">
            <div className="horizontal">
                <Button name={"update"} onClick={updateOrders}/>
            </div>
        </div>
    )
}

export {
    OrderList
}