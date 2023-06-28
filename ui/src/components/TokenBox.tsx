import React, { ChangeEvent, FC, useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { DatalistInput, Item } from "react-datalist-input";
import { amountToStr, WalletToken } from "../p2p-swap";
import { Visibility } from "./Visibility";
import { getMint, Mint } from "@solana/spl-token";
import Decimal from "decimal.js";

interface TokenBoxProps {
    name: string,
    onTokenChanged: (token: Mint|undefined) => void,
    onAmountChanged: (amount: bigint|undefined) => void,
    sellSide?: boolean,
    disableInput?: boolean,
}

interface TokenItemProps {
    label: string,
}

const TokenItem: FC<TokenItemProps> = (props) => {
    return (
        <div className="token-item">
            <div className="horizontal">
                <label><b>{props.label}</b></label>
            </div>
        </div>
    )
}

const TokenBox: FC<TokenBoxProps> = (props) => {
    const {
        connection,
        walletTokens,
        updateWalletTokens,
        supportedTokens,
        explorer,
        cluster,
        showErrorMessage,
    } = useApp();
    const [tokenName, setTokenName] = useState<string|undefined>(undefined);
    const [tokens, setTokens] = useState<Item[]>([]);
    const [selectedTokenMint, setSelectedTokenMint] = useState<Mint|undefined>(undefined);
    const [selectedToken, setSelectedToken] = useState<WalletToken|undefined>(undefined);
    const [amountStr, setAmountStr] = useState<string|undefined>('0');
    const [amountStyle, setAmountStyle] = useState<string>('invalid');

    useEffect(()=> {
        const impl = async() => {
            if (!tokenName) {
                setSelectedTokenMint(undefined);
                setSelectedToken(undefined);
                return;
            }

            let token = supportedTokens.get(tokenName);
            if (!token) {
                setSelectedTokenMint(undefined);
                return;
            }

            try {
                let mint = await getMint(connection, token.pubkey);
                setSelectedTokenMint(mint);
                setSelectedToken(walletTokens.get(mint.address.toString()));
            } catch (e: any) {
                showErrorMessage(e.toString());
            }
        }

        impl().then(()=>{});
    }, [tokenName]);

    const onAmountChange = (event: ChangeEvent<any>) => {
        setAmountStr(event.target.value);
    }

    const maxButtonClick = () => {
        if (!selectedToken || !selectedTokenMint) {
            return;
        }
        setAmountStr(amountToStr(selectedToken.tokenAmount, selectedTokenMint.decimals));
    }

    const onExplorerClick = () => {
        if (!selectedTokenMint) {
            return;
        }

        let url = `${explorer}/token/${selectedTokenMint.address.toBase58()}?cluster=${cluster}`;
        window.open(url);
    }

    useEffect(() => {
        let tokens = [];
        for (let [label, token] of supportedTokens) {
            if (props.sellSide) {
                let walletToken = walletTokens.get(token.pubkey.toString());
                if (!walletToken)
                    continue;
            }

            tokens.push({
                            id: label,
                            node: <TokenItem label={label} />
                        });
        }

        setTokens(tokens);
        setTokenName(undefined);
        setSelectedToken(undefined);
        setSelectedTokenMint(undefined);
        setAmountStr('');
    }, [walletTokens, supportedTokens]);

    useEffect(() => {
        props.onTokenChanged(selectedTokenMint);
        if (!amountStr) {
            setAmountStyle('invalid');
            return;
        }

        if (!selectedTokenMint) {
            return;
        }

        try {
            let amountDec =
                    new Decimal(amountStr)
                        .mul(Math.pow(10, selectedTokenMint.decimals));

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
                if (selectedToken && amount > selectedToken.tokenAmount) {
                    props.onAmountChanged(selectedToken.tokenAmount);
                    setAmountStr(amountToStr(selectedToken.tokenAmount, selectedToken.decimals));
                } else {
                    props.onAmountChanged(amount);
                }
            } else {
                props.onAmountChanged(amount);
            }
        } catch (e: any) {
            setAmountStyle('invalid');
        }
    }, [amountStr, selectedToken, selectedTokenMint]);

    return (
        <div className="token-box">
            <label><b>{props.name}</b></label>
            <DatalistInput
                className={"datalist"}
                inputProps={{
                    type: "number",
                    className: selectedTokenMint ? '' : 'invalid',
                    title: selectedTokenMint?.address.toBase58(),
                    onClick: updateWalletTokens,
                }}
                label={''}
                showLabel={false}
                isExpandedClassName="token-list"
                value={tokenName}
                items={tokens}
                onSelect={(item: Item) => {setTokenName(item.node.props.label)}}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {setTokenName(event.target.value)}}
            />
            <Visibility isActive={!props.disableInput}>
                <input
                    className={amountStyle}
                    type='number'
                    onChange={onAmountChange}
                    value={amountStr}
                    disabled={!selectedTokenMint}
                />
            </Visibility>
            <Visibility isActive={!!props.sellSide}>
                <button
                    className='fixed'
                    disabled={!selectedToken}
                    title="Place all your tokens"
                    onClick={maxButtonClick}
                >MAX</button>
            </Visibility>
            <button
                disabled={!selectedTokenMint}
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