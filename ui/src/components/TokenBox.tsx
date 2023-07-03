import React, { FC, useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { amountToStr, WalletToken } from "../p2p-swap";
import { Mint } from "@solana/spl-token";
import Decimal from "decimal.js";
import { SelectedToken, TokenSelect } from "./TokenSelect";
import Slider from "@mui/material/Slider";
import { AmountInput } from "./AmountInput";

interface TokenBoxProps {
    name: string,
    onTokenChanged: (token: Mint|undefined) => void,
    onAmountChanged: (amount: bigint) => void,
}

const TokenBox: FC<TokenBoxProps> = (props) => {
    const {
        walletTokens,
    } = useApp();

    const [selectedToken, setSelectedToken] = useState<SelectedToken|null>(null);
    const [walletToken, setWalletToken] = useState<WalletToken|undefined>(undefined);
    const [amount, setAmount] = useState<bigint>(0n);
    const [amountStr, setAmountStr] = useState<string>('0');
    const [amountPercent, setAmountPercent] = useState<number|undefined>(0);

    useEffect(() => {
        setAmountStr('0');
        setAmount(0n);
        setAmountPercent(0);
        props.onAmountChanged(0n);
        props.onTokenChanged(selectedToken?.mint);
        if (!selectedToken) {
            return;
        }

        setWalletToken(walletTokens.get(selectedToken.mint.address.toBase58()));
    }, [selectedToken, walletTokens]);

    useEffect(() => {
        if (!selectedToken || !walletToken || walletToken.tokenAmount === 0n) {
            return;
        }

        try {
            let percent = (new Decimal(amount.toString())
                .div(new Decimal(walletToken.tokenAmount.toString()))).mul(100)
                .toSignificantDigits(selectedToken.mint.decimals);

            setAmountPercent(Math.round(percent.toNumber()));

        } catch (e: any) {
        }
    }, [amount, walletToken]);

    const onAmountChange = (amount: bigint) => {
        props.onAmountChanged(amount);
        setAmount(amount);
    }

    const onSliderChange = (event: any, value: number|number[]) => {
        if (walletToken && (typeof(value) === 'number')) {
            setAmountPercent(value);
            setAmountStr(
                amountToStr(
                    (walletToken.tokenAmount * BigInt(value)) / 100n,
                    walletToken.decimals
                )
            );
        }
    };

    return (
        <div className='vertical'>
            <div className='horizontal'>
                <label><h3>{props.name}</h3></label>
                <TokenSelect onTokenSelected={setSelectedToken}/>
                {
                    (!walletToken || walletToken.tokenAmount == 0n)
                        ? <label><h3>wallet empty</h3></label>
                        : <AmountInput
                            disabled={!walletToken}
                            decimals={walletToken ? walletToken.decimals : 0}
                            valueStr={amountStr}
                            setValueStr={setAmountStr}
                            onValueChanged={onAmountChange}
                            maximum={walletToken ? walletToken.tokenAmount : 0n}
                        />
                }
            </div>
            <div className="horizontal">
                <Slider
                    className='slider'
                    value={amountPercent}
                    onChange={onSliderChange}
                    disabled={!walletToken || walletToken.tokenAmount == 0n}
                    min={0}
                    max={100}
                />
                <label><h3>{amountPercent}%</h3></label>
            </div>
        </div>

    )
}

export {
    TokenBox
}