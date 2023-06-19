import { ConnectionContextState, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, {FC, useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {
    FillOrderProps,
    fillOrderTransaction,
    getOrderDescriptionChecked,
    parseBigInt, parseUnlockKey,
    publicKeyChecker,
    unlockKeyChecker
} from "../p2p-swap";
import {P2P_SWAP_DEVNET} from "../p2p-swap";
import {useApp} from "../AppContext";
import {Button} from "./Button";
import {Visibility} from "./Visibility";

const BuyTab: FC = () => {
    const {
        orderAddress, setOrderAddress,
        unlockKey, setUnlockKey,
        buyOrderDescription, setBuyOrderDescription,
    } = useApp();
    const {wallet} = useWallet();
    const {connection} = useConnection();
    const [errorDescription, setErrorDescription] = useState<string|null>("Wrong order address");
    const [buyAmount, setBuyAmount] = useState<string>("0");
    const [fillOrderTxn, setFillOrderTxn] = useState<Transaction|null>(null);
    const connectionContext = useConnection();
    const [buyButtonName, setBuyButtonName] = useState("Buy");

    useEffect(() => {
        async function updateOrderDescription(
            connectionContext: ConnectionContextState,
            orderAddress: PublicKey
        ) {
            setBuyOrderDescription(null);
            setErrorDescription("Loading...");
            try {
                let orderDescription
                    = await getOrderDescriptionChecked(connectionContext.connection, orderAddress, P2P_SWAP_DEVNET);
                setBuyOrderDescription(orderDescription);
                setErrorDescription(null);
            } catch (e: any) {
                setErrorDescription(e.toString());
            }
        }

        if (orderAddress)
            updateOrderDescription(connectionContext, new PublicKey(orderAddress)).then(() => {});
        else
            setErrorDescription('Wrong order address');
    }, [connectionContext, orderAddress]);

    useEffect(() => {
        const sendTransaction = async () => {
            let signer = wallet?.adapter.publicKey;
            let unlockKeyParsed = parseUnlockKey(unlockKey);
            let buyAmountParsed = parseBigInt(buyAmount);
            if (signer && orderAddress && buyOrderDescription && buyAmountParsed && buyAmountParsed > BigInt(0) && unlockKeyParsed) {
                let props: FillOrderProps = {
                    order: buyOrderDescription,
                    orderAddress: orderAddress,
                    programId: P2P_SWAP_DEVNET,
                    sellTokenAmount: buyAmountParsed,
                    signer: signer,
                };

                if (buyOrderDescription.isPrivate && unlockKeyParsed) {
                    props.unlockKey = unlockKeyParsed;
                }

                setFillOrderTxn(await fillOrderTransaction(connection, props));
            } else {
                setFillOrderTxn(null);
            }
        };

        sendTransaction().then(()=>{});
    }, [orderAddress, buyAmount, unlockKey]);

    const onOrderAddressChange = (value: string|null) => {
        try {
            setOrderAddress(value ? new PublicKey(value) : null);
        } catch (e) {
            setErrorDescription('Wrong order address');
        }
    }

    const onBuyClicked = async () => {
        if (fillOrderTxn) {
            let txn = fillOrderTxn;
            setFillOrderTxn(null);
            setBuyButtonName("Submitting...");

            try {
                await wallet?.adapter.sendTransaction(txn, connection);
            } catch (e) {
                console.log(`Failed to fill order: ${e}`);
            }

            setFillOrderTxn(txn);
            setBuyButtonName("Buy");
        }
    }

    return (
        <div className="vertical">
            <ValueEdit
                name={"Order Address:"}
                onChange={onOrderAddressChange}
                valueChecker={publicKeyChecker}
                value={orderAddress ? orderAddress.toString() : ""}
            />
            <OrderDescription description={buyOrderDescription}/>
            <Visibility isActive={!!errorDescription}>
                <h1>{errorDescription}</h1>
            </Visibility>
            <Visibility isActive={!!buyOrderDescription}>
                <div className="vertical">
                    <ValueEdit
                        name="Amount:"
                        onChange={setBuyAmount}
                        valueChecker={(value) => {
                            if (!value) {
                                return false;
                            }

                            try {
                                let v = BigInt(value);
                                return v > 0;
                            } catch (e) {return false}
                        }}
                        readonly={false}
                        value={buyAmount.toString()}
                    />
                    <Visibility isActive={!!buyOrderDescription && buyOrderDescription.isPrivate}>
                        <ValueEdit
                            name="Unlock signature:"
                            onChange={setUnlockKey}
                            valueChecker={unlockKeyChecker}
                            value={unlockKey ? unlockKey : ""}
                        />
                    </Visibility>
                    <Button
                        name={buyButtonName}
                        onClick={onBuyClicked}
                        disabled={fillOrderTxn === null}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { BuyTab }