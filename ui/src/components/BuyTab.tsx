import {ConnectionContextState, useConnection} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, {FC, useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {
    getOrderDescriptionChecked,
    parseBigInt, parseUnlockKey,
    publicKeyChecker,
    unlockKeyChecker
} from "../p2p-swap"
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
    const [errorDescription, setErrorDescription] = useState<string|null>("Wrong order address");
    const [buyAmount, setBuyAmount] = useState<string>("0");
    const [buyTransaction, setBuyTransaction] = useState<string|null>(null);
    const connectionContext = useConnection();

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
        let unlockKeyParsed = parseUnlockKey(unlockKey);
        let buyAmountParsed = parseBigInt(buyAmount);
        if (buyAmountParsed && buyAmountParsed > BigInt(0) && unlockKeyParsed) {
            setBuyTransaction("YESSS!!!");
        } else {
            setBuyTransaction(null);
        }
    }, [orderAddress, buyAmount, unlockKey]);

    const onOrderAddressChange = (value: string|null) => {
        try {
            setOrderAddress(value ? new PublicKey(value) : null);
        } catch (e) {
            setErrorDescription('Wrong order address');
        }
    }

    const onBuyClicked = () => {
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
                        name="Buy"
                        onClick={onBuyClicked}
                        disabled={buyTransaction === null}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { BuyTab }