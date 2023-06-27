import React, { ChangeEvent, FC, useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { DatalistInput, Item } from "react-datalist-input";
import { PublicKey } from "@solana/web3.js";
import { amountToStr, parseBigInt, WalletToken } from "../p2p-swap";
import { Visibility } from "./Visibility";

interface TokenBoxProps {
    name: string,
    onTokenChanged: (token: WalletToken|undefined) => void,
    onAmountChanged: (amount: bigint|undefined) => void,
    limitWalletAmount?: boolean,
}

interface TokenItemProps {
    value: PublicKey,
    label?: string,
}

const TokenItem: FC<TokenItemProps> = (props) => {
    return (
        <div className="token-item">
            <div className="horizontal">
                <label><b>{props.label}</b>{": " + props.value.toBase58()}</label>
            </div>
        </div>
    )
}

function strToAmount(value: string, token: WalletToken): bigint {
    let [intPartStr, decPartStr] = value.split('.');

    let intPart: bigint|null = 0n;
    let decPart: bigint|null = 0n;
    if (intPartStr) intPart = parseBigInt(intPartStr);

    if (decPartStr) {
        if (decPartStr.length > token.decimals) {
            decPartStr = decPartStr.substring(0, token.decimals);
        } else if (decPartStr.length < token.decimals) {
            decPartStr = decPartStr.padEnd(token.decimals, '0');
        }
        decPart = parseBigInt(decPartStr);
    }

    if (intPart !== null && decPart !== null) {
        return intPart * (10n ** BigInt(token.decimals)) + decPart;
    }

    throw `Failed to convert '${value}' to bigint`;
}



const TokenBox: FC<TokenBoxProps> = (props) => {
    const {
        walletTokens,
        explorer,
        cluster,
    } = useApp();
    const [tokenName, setTokenName] = useState<string|undefined>(undefined);
    const [tokens, setTokens] = useState<Item[]>([]);
    const [selectedToken, setSelectedToken] = useState<WalletToken|undefined>(undefined);
    const [amountStr, setAmountStr] = useState<string|undefined>('0');
    const [amountStyle, setAmountStyle] = useState<string>('invalid');

    const onTokenSelected = (item: Item) => {
        if (!walletTokens) {
            return;
        }
        setTokenName(item.node.props.label);
        setSelectedToken(walletTokens.get(item.node.props.label));
    };

    const onTokenChange = (event: any) => {
        if (!walletTokens) {
            return;
        }
        setTokenName(event.target.value);
        setSelectedToken(walletTokens.get(event.target.value));
    };

    const onAmountChange = (event: ChangeEvent<any>) => {
        setAmountStr(event.target.value);
    }

    const maxButtonClick = () => {
        if (!selectedToken) {
            return;
        }
        setAmountStr(amountToStr(selectedToken.tokenAmount, selectedToken.decimals));
    }

    const onExplorerClick = () => {
        if (!selectedToken) {
            return;
        }

        let url = `${explorer}/token/${selectedToken?.mint.toBase58()}?cluster=${cluster}`;
        window.open(url);
    }

    useEffect(() => {
        if (!walletTokens) {
            return;
        }
        let tokens = [];
        console.log(walletTokens);
        for (let [, walletToken] of walletTokens) {
            if (walletToken.label) {
                tokens.push({
                                id: walletToken.label,
                                node: <TokenItem
                                    value={walletToken.mint}
                                    label={walletToken.label}
                                />
                            });
            }
        }

        setTokens(tokens);
    }, [walletTokens]);

    useEffect(() => {
        props.onTokenChanged(selectedToken)
        if (!selectedToken) {
            return;
        }

        if (!amountStr) {
            setAmountStyle('invalid');
            return;
        }

        try {
            if (parseFloat(amountStr) < 1) {
                props.onAmountChanged(1n);
                setAmountStr(amountToStr(1n, selectedToken.decimals));
                return;
            }

            let amount = strToAmount(amountStr, selectedToken);
            if (amount < 1) {
                setAmountStyle('invalid');
                return;
            }

            setAmountStyle('');
            if (props.limitWalletAmount && amount > selectedToken.tokenAmount) {
                props.onAmountChanged(selectedToken.tokenAmount);
                setAmountStr(amountToStr(selectedToken.tokenAmount, selectedToken.decimals));
                return;
            }
            props.onAmountChanged(amount);
        } catch (e) {
            console.log(`TokenBox: ${e}`);
            setAmountStyle('invalid');
        }
    }, [amountStr, selectedToken]);

    return (
        <div className="token-box">
            <label><b>{props.name}</b></label>
            <input
                className={amountStyle}
                type='number'
                onChange={onAmountChange}
                value={amountStr}
                disabled={!selectedToken}
            />
            <Visibility isActive={!!props.limitWalletAmount}>
                <button
                    className='fixed'
                    disabled={!selectedToken}
                    title="Place all your tokens"
                    onClick={maxButtonClick}
                >MAX</button>
            </Visibility>
            <DatalistInput
                className={"datalist"}
                inputProps={{
                    type: "number",
                    className: selectedToken ? '' : 'invalid',
                    title: selectedToken?.mint.toBase58()
                }}
                label={''}
                showLabel={false}
                isExpandedClassName="token-list"
                value={tokenName}
                items={tokens}
                onSelect={onTokenSelected}
                onChange={onTokenChange}
            />
            <button
                disabled={!selectedToken}
                className='fixed'
                onClick={onExplorerClick}
                title="Open in explorer"
            >explorer</button>
        </div>
    )
}

export {
    TokenBox
}