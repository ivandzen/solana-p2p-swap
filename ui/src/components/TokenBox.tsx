import React, { ChangeEvent, EventHandler, FC, useEffect, useState } from "react";
import { Mint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useApp } from "../AppContext";
import { DatalistInput, Item } from "react-datalist-input";
import { Connection, PublicKey } from "@solana/web3.js";
import { parseBigInt, WalletToken } from "../p2p-swap";
import { Button } from './Button';

interface TokenBoxProps {
    onTokenChanged: (token: WalletToken|undefined) => void,
    onAmountChanged: (amount: bigint|undefined) => void,
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

function amountToStr(value: bigint, token: WalletToken): string {
    let intPart = value / 10n ** BigInt(token.decimals);
    let decPart = value - intPart * (10n ** BigInt(token.decimals));
    return `${intPart}.${decPart}`;
}

const TokenBox: FC<TokenBoxProps> = (props) => {
    const {
        supportedTokens,
        walletTokens,
        explorer,
        cluster,
    } = useApp();
    const [tokenName, setTokenName] = useState<string|undefined>(undefined);
    const [tokenAddress, setTokenAddress] = useState<string|undefined>(undefined);
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
        setAmountStr(amountToStr(selectedToken.tokenAmount, selectedToken));
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
            let amount = strToAmount(amountStr, selectedToken);
            if (amount < 1) {
                setAmountStyle('invalid');
                return;
            }

            setAmountStyle('');
            if (amount > selectedToken.tokenAmount) {
                props.onAmountChanged(selectedToken.tokenAmount);
                setAmountStr(amountToStr(selectedToken.tokenAmount, selectedToken));
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
            <input
                className={amountStyle}
                type='number'
                onChange={onAmountChange}
                value={amountStr}
                disabled={!selectedToken}
            />
            <Button
                disabled={!selectedToken}
                name="MAX"
                onClick={maxButtonClick}
            />
            <DatalistInput
                className={"datalist"}
                inputProps={{
                    type: "number",
                    className: selectedToken ? '' : 'invalid',
                    title: tokenName
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
                className='tabbutton-active'
                onClick={onExplorerClick}
                title="Open in explorer"
            >explorer</button>
        </div>
    )
}

export {
    TokenBox
}