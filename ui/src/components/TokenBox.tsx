import React, { ChangeEvent, FC, useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { amountToStr, WalletToken } from "../p2p-swap";
import { Visibility } from "./Visibility";
import { Mint } from "@solana/spl-token";
import Decimal from "decimal.js";
import { SelectedToken, TokenSelect } from "./TokenSelect";

interface TokenBoxProps {
    onTokenChanged: (token: Mint|undefined) => void,
    onAmountChanged: (amount: bigint|undefined) => void,
    sellSide?: boolean,
}

const TokenBox: FC<TokenBoxProps> = (props) => {
    const {
        walletTokens,
    } = useApp();

    const [selectedToken, setSelectedToken] = useState<SelectedToken|null>(null);
    const [walletToken, setWalletToken] = useState<WalletToken|undefined>(undefined);
    const [amountStr, setAmountStr] = useState<string|undefined>('0');
    const [amountStyle, setAmountStyle] = useState<string>('invalid');


    useEffect(() => {
        if (!selectedToken) {
            return;
        }

        setWalletToken(walletTokens.get(selectedToken.mint.address.toBase58()));
    }, [selectedToken, walletTokens]);

    const onAmountChange = (event: ChangeEvent<any>) => {
        setAmountStr(event.target.value);
    }

    const maxButtonClick = () => {
        if (!walletToken || !selectedToken) {
            return;
        }
        setAmountStr(amountToStr(walletToken.tokenAmount, selectedToken.mint.decimals));
    }

    useEffect(() => {
        if (!amountStr) {
            setAmountStyle('invalid');
            return;
        }

        if (!selectedToken) {
            return;
        }

        try {
            let amountDec =
                    new Decimal(amountStr)
                        .mul(Math.pow(10, selectedToken.mint.decimals));

            if (amountDec.lessThan(1)) {
                setAmountStr('0');
                setAmountStyle('invalid');
                return;
            }

            let amount = BigInt(amountDec.toString());
            if (amount < 1n) {
                setAmountStyle('invalid');
                return;
            }

            setAmountStyle('');
            if (props.sellSide) {
                if (!walletToken) {
                    props.onAmountChanged(0n);
                    props.onTokenChanged(undefined);
                    setAmountStr('0');
                    return;
                }

                if (walletToken.tokenAmount == 0n) {
                    props.onAmountChanged(0n);
                    setAmountStr('0')
                } else if (amount > walletToken.tokenAmount) {
                    props.onAmountChanged(walletToken.tokenAmount);
                    setAmountStr(amountToStr(walletToken.tokenAmount, walletToken.decimals));
                } else {
                    props.onAmountChanged(amount);
                }
            } else {
                props.onAmountChanged(amount);
            }

            props.onTokenChanged(selectedToken.mint);
        } catch (e: any) {
            setAmountStyle('invalid');
        }
    }, [amountStr, walletToken]);

    return (
        <div className="horizontal">
            <input
                className={amountStyle}
                type='number'
                onChange={onAmountChange}
                value={amountStr}
                disabled={!selectedToken?.mint}
            />
            <Visibility isActive={!!props.sellSide}>
                <button
                    className='fixed'
                    disabled={!walletToken || walletToken.tokenAmount == 0n}
                    title={!walletToken || walletToken.tokenAmount == 0n
                        ? `You have no ${selectedToken?.name}`
                        : "Place all your tokens" }
                    onClick={maxButtonClick}
                >
                    {!walletToken || walletToken.tokenAmount == 0n ? `empty` : 'MAX'}
                </button>
            </Visibility>
            <TokenSelect onTokenSelected={setSelectedToken}/>
        </div>
    )
}

export {
    TokenBox
}