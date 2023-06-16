import {ConnectionContextState, useConnection} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import {OrderDescription} from "./OrderDescription";
import React, {ChangeEvent, FC, useEffect, useState} from "react";
import {ValueEdit} from "./ValueEdit";
import {getOrderDescriptionChecked, OrderDescriptionData, publicKeyChecker} from "../p2p-swap"
import {P2P_SWAP_DEVNET} from "../p2p-swap";
import {useApp} from "../AppContext";
import {Button} from "./Button";
import {Visibility} from "./Visibility";

const BuyTab: FC = () => {
    const {appState, setAppState} = useApp();
    const [orderDescription, setOrderDescription]
        = useState<OrderDescriptionData|string>("Wrong order address");
    const connectionContext = useConnection();
    useEffect(() => {
        async function updateOrderDescription(
            connectionContext: ConnectionContextState,
            orderAddress: PublicKey
        ) {
            setOrderDescription('Loading...');
            try {
                let orderDescription
                    = await getOrderDescriptionChecked(connectionContext.connection, orderAddress, P2P_SWAP_DEVNET);
                setOrderDescription(orderDescription);
            } catch (e: any) {
                setOrderDescription(e.toString());
            }
        }

        if (appState.orderAddress)
            updateOrderDescription(connectionContext, new PublicKey(appState.orderAddress)).then(() => {});
        else
            setOrderDescription('Wrong order address');

    }, [connectionContext, appState]);

    const setOrderAddress = (value: string|undefined) => {
        setAppState({
            appMode: "Buy",
            orderAddress: value ? new PublicKey(value) : null,
        })
    }

    const onBuyClicked = () => {
    }

    return (
        <div className="vertical">
            <ValueEdit
                name={"Order Address:"}
                onChange={setOrderAddress}
                valueChecker={publicKeyChecker}
                value={appState?.orderAddress ? appState.orderAddress.toString() : undefined}
            />
            <OrderDescription description={orderDescription}/>
            <Visibility isActive={typeof(orderDescription) !== 'string'}>
                <div className="vertical">
                    <ValueEdit
                        name="Amount:"
                        onChange={(value)=>{}}
                        valueChecker={(value)=>{ return true; }}
                        size={35}
                        readonly={false}
                        value="0"
                    />
                    <Visibility isActive={typeof orderDescription !== 'string' && orderDescription.isPrivate}>
                        <ValueEdit
                            name="Unlock signature:"
                            onChange={(value)=>{}}
                            valueChecker={(value)=>{ return true; }}
                            size={35}
                            readonly={false}
                            value=" "
                        />
                    </Visibility>
                    <Button
                        name="Buy"
                        className="tabbutton-active"
                        onClick={onBuyClicked}
                    />
                </div>
            </Visibility>
        </div>
    )
}

export { BuyTab }