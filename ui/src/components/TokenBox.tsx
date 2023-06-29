import React, { ChangeEvent, FC, useEffect, useState } from "react";
import { useApp } from "../AppContext";
import { DatalistInput, Item } from "react-datalist-input";
import { amountToStr, getTokens, WalletToken } from "../p2p-swap";
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
    const [tokenMint, setTokenMint] = useState<Mint|undefined>(undefined);
    const [walletToken, setWalletToken] = useState<WalletToken|undefined>(undefined);
    const [amountStr, setAmountStr] = useState<string|undefined>('0');
    const [amountStyle, setAmountStyle] = useState<string>('invalid');

    useEffect(()=> {
        const impl = async() => {
            if (!tokenName) {
                setTokenMint(undefined);
                return;
            }

            let token = supportedTokens.get(tokenName);
            if (!token) {
                setTokenMint(undefined);
                return;
            }

            try {
                let mint = await getMint(connection, token.pubkey);
                setTokenMint(mint);
            } catch (e: any) {
                showErrorMessage(e.toString());
            }
        }

        impl().then(()=>{});
    }, [tokenName]);

    useEffect(() => {
        if (!tokenMint) {
            return;
        }

        setWalletToken(walletTokens.get(tokenMint.address.toBase58()));
        props.onTokenChanged(tokenMint);
    }, [tokenMint, walletTokens]);

    const onAmountChange = (event: ChangeEvent<any>) => {
        setAmountStr(event.target.value);
    }

    const maxButtonClick = () => {
        if (!walletToken || !tokenMint) {
            return;
        }
        setAmountStr(amountToStr(walletToken.tokenAmount, tokenMint.decimals));
    }

    const onExplorerClick = () => {
        if (!tokenMint) {
            return;
        }

        let url = `${explorer}/token/${tokenMint.address.toBase58()}?cluster=${cluster}`;
        window.open(url);
    }

    useEffect(() => {
        let tokens = [];
        for (let [label, ] of supportedTokens) {
            tokens.push({
                            id: label,
                            node: <TokenItem label={label} />
                        });
        }

        setTokens(tokens);
        setTokenName(tokens.length ? tokens[0].id : '');
        setAmountStr('0');
    }, [supportedTokens]);

    useEffect(() => {
        if (!amountStr) {
            setAmountStyle('invalid');
            return;
        }

        if (!tokenMint) {
            return;
        }

        try {
            let amountDec =
                    new Decimal(amountStr)
                        .mul(Math.pow(10, tokenMint.decimals));

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
                if (!walletToken || walletToken.tokenAmount == 0n) {
                    setAmountStr('0')
                } else if (walletToken && amount > walletToken.tokenAmount) {
                    props.onAmountChanged(walletToken.tokenAmount);
                    setAmountStr(amountToStr(walletToken.tokenAmount, walletToken.decimals));
                } else {
                    props.onAmountChanged(amount);
                }
            } else {
                props.onAmountChanged(amount);
            }
        } catch (e: any) {
            setAmountStyle('invalid');
        }
    }, [amountStr, walletToken]);

    return (
        <div className="token-box">
            <label><b>{props.name}</b></label>
            <DatalistInput
                className={"datalist"}
                inputProps={{
                    type: "number",
                    className: tokenMint ? '' : 'invalid',
                    title: tokenMint?.address.toBase58(),
                }}
                label={''}
                showLabel={false}
                isExpandedClassName="token-list"
                value={tokenName}
                items={tokens}
                onSelect={(item: Item) => {setTokenName(item.node.props.label)}}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {setTokenName(event.target.value)}}
            />
            <Visibility isActive={!!props.sellSide}>
                <button
                    className='fixed'
                    disabled={!walletToken || walletToken.tokenAmount == 0n}
                    title={!walletToken || walletToken.tokenAmount == 0n
                        ? `You have no ${tokenName}`
                        : "Place all your tokens" }
                    onClick={maxButtonClick}
                >{!walletToken || walletToken.tokenAmount == 0n ? `You have no ${tokenName}` : 'MAX'}</button>
            </Visibility>
            <Visibility isActive={!props.disableInput}>
                <input
                    className={amountStyle}
                    type='number'
                    onChange={onAmountChange}
                    value={amountStr}
                    disabled={!tokenMint}
                />
            </Visibility>
            <button
                disabled={!tokenMint}
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