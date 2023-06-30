import React, { FC, ReactNode, useEffect, useState } from "react";
import { getTokenName, SupportedTokens, useApp } from "../AppContext";
import { Button } from "./Button";
import {
    amountToDecimal,
    ORDER_ACCOUNT_SIZE,
    OrderDescriptionData,
    P2P_SWAP_DEVNET,
    parseOrderDescription
} from "../p2p-swap";
import { PublicKey } from "@solana/web3.js";
import { Mint, unpackMint } from "@solana/spl-token";
import Decimal from "decimal.js";
import { Visibility } from "./Visibility";

interface OrderItemProps {
    pubkey: PublicKey,
    sellToken: string,
    buyToken: string,
    price: Decimal,
    availableSellTokens: Decimal,
    sellTokenDecimals: number,
    buyTokenDecimals: number,
    isPrivate: boolean,
}

export const OrderItem: FC<OrderItemProps> = (props) => {
    let {setAppMode, setOrderAddress} = useApp();
    const onClick = () => {
        setOrderAddress(props.pubkey);
        setAppMode("Buy");
    }

    return (
        <tr className='order-list-item' title={props.pubkey.toBase58()}>
            <td className='order-list-item-element' onClick={onClick}>{props.sellToken}</td>
            <td className='order-list-item-element' onClick={onClick}>{props.buyToken}</td>
            <td className='order-list-item-element' onClick={onClick}>
                {`1 ${props.sellToken} = 
                ${props.price.toSignificantDigits(props.buyTokenDecimals).toString()} 
                ${props.buyToken}`}
            </td>
            <td className='order-list-item-element' onClick={onClick}>
                {`${props.availableSellTokens.toSignificantDigits(props.sellTokenDecimals).toString()} 
                ${props.sellToken}`}
            </td>
            <td className='order-list-item-element' onClick={onClick}>
                {props.isPrivate ? 'Yes' : 'No'}
            </td>
        </tr>
    )
}

export interface OrderListProps {

}

export const OrderList: FC<OrderListProps> = (props) => {
    const {
        connection,
        supportedTokens,
        showErrorMessage,
        appMode,
    } = useApp();

    let [items, setItems] = useState<ReactNode[]>([]);
    let [pageMessage, setPageMessage] = useState<string|null>(null);

    const updateOrders = async () => {
        let accounts = await connection.getProgramAccounts(
            P2P_SWAP_DEVNET,
            {
                filters: [{dataSize: ORDER_ACCOUNT_SIZE}]
            })

        let tokens: Set<PublicKey> = new Set();
        let orders: Map<PublicKey, OrderDescriptionData> = new Map();
        for (let {account, pubkey} of accounts) {
            try {
                let order = parseOrderDescription(account.data);
                tokens.add(order.tokenMint);
                tokens.add(order.priceMint);
                orders.set(pubkey, order);
            } catch (e) {
                console.log(`Failed to parse order ${pubkey}: ${e}`);
            }
        }

        let mintAddresses = Array.from(tokens);
        let mintAccounts
            = await connection.getMultipleAccountsInfo(mintAddresses);
        if (mintAddresses.length != mintAccounts.length) {
            console.log("Something wne wrong. Try one more time");
            return;
        }

        let mints: Map<string, Mint> = new Map();
        for (let i = 0; i < mintAccounts.length; i++) {
            try {
                mints.set(
                    mintAddresses[i].toBase58(),
                    unpackMint(mintAddresses[i], mintAccounts[i])
                );
            } catch (e: any) {
                console.log(`Failed to unpack Mint from account ${mintAddresses[i]}: ${e}`);
            }
        }

        let items: ReactNode[] = [];
        for (let [pubkey, order] of orders) {
            let sellTokenName = getTokenName(supportedTokens, order.tokenMint);
            let buyTokenName = getTokenName(supportedTokens, order.priceMint);
            let sellToken = mints.get(order.tokenMint.toBase58());
            let buyToken = mints.get(order.priceMint.toBase58());
            if (!sellTokenName || !buyTokenName || !sellToken || !buyToken
                || order.remainsToFill < order.minSellAmount) {
                continue;
            }

            let price =
                amountToDecimal(order.buyAmount, buyToken.decimals)
                    .div(amountToDecimal(order.sellAmount, sellToken.decimals));

            items.push(
                <OrderItem
                    pubkey={pubkey}
                    sellToken={sellTokenName}
                    buyToken={buyTokenName}
                    price={price}
                    availableSellTokens={amountToDecimal(order.remainsToFill, sellToken.decimals)}
                    sellTokenDecimals={sellToken.decimals}
                    buyTokenDecimals={buyToken.decimals}
                    isPrivate={order.isPrivate}
                />);
        }

        setItems(items);
    }

    useEffect(() => {
        const impl = async() => {
            if (appMode == 'Orders') {
                try {
                    await updateOrders();
                } catch (e: any) {
                    showErrorMessage(e.toString(), true);
                }
            }
        }

        setPageMessage('Updating...');
        impl().then(()=>{});
        setPageMessage(null);
    }, [appMode]);

    const onUpdateClick = async () => {
        setPageMessage('Updating...');
        try {
            await updateOrders();
        } catch (e: any) {
            showErrorMessage(e.toString(), true);
        }
        setPageMessage(null);
    }

    return (
        <div className="table-like">
            <div className="vertical">
                <Button name={"update"} onClick={onUpdateClick}/>
                <Visibility isActive={pageMessage === null}>
                    <div className='order-list'>
                        <table>
                            <tr className='order-list-header'>
                                <th className='order-list-item-element'>You will get</th>
                                <th className='order-list-item-element'>You will pay</th>
                                <th className='order-list-item-element'>Price</th>
                                <th className='order-list-item-element'>Available</th>
                                <th className='order-list-item-element'>Private</th>
                            </tr>
                            {items}
                        </table>
                    </div>
                </Visibility>
                <Visibility isActive={pageMessage !== null}>
                    <h1>{pageMessage}</h1>
                </Visibility>
            </div>
        </div>
    )
}
