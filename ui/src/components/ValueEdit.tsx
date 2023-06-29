import React, {ChangeEvent, FC, useEffect, useState} from "react";
import {Visibility} from "./Visibility";

interface ValueEditProps {
    name: string,
    onChange?: (value: string) => void,
    valueChecker?: (value: string|undefined) => boolean,
    size?: number,
    readonly?: boolean,
    value?: string,
    type?: string,
    copybutton?: boolean,
}

const ValueEdit: FC<ValueEditProps> = (attribs: ValueEditProps) => {
    let [value, setValue] = useState(attribs.value ? attribs.value : '');
    let initialStyle = '';
    if (attribs.readonly)
        initialStyle = '';
    else if (attribs.valueChecker && !attribs.valueChecker(attribs.value))
        initialStyle = 'invalid';

    const checkAndSetValue = (value: string) => {
        if (attribs.readonly) {
            setInputStyle("");
        }

        setInputStyle(
            attribs.valueChecker && !attribs.valueChecker(value)
            ? "invalid"
            : ""
        );

        setValue(value);
        if (attribs.onChange)
            attribs.onChange(value);
    }

    let [inputStyle, setInputStyle] = useState(initialStyle);
    let checkValue = (event: ChangeEvent<HTMLInputElement>) => {
        let eventValue = event.target.value;
        checkAndSetValue(eventValue);
    };

    useEffect(() => {
        checkAndSetValue(attribs.value ? attribs.value : "");
    }, [attribs.value]);

    return (
        <div className="horizontal">
            <label className="label"><b>{attribs.name}</b></label>
            <input
                type={attribs.type ? attribs.type : "text"}
                className={inputStyle}
                onChange={checkValue}
                readOnly={attribs.readonly ? attribs.readonly : false}
                value={value}
            />
            <Visibility isActive={!!attribs.copybutton}>
                <button
                    className="copy-button"
                    title='Copy value'
                    onClick={() => {navigator.clipboard.writeText(value).then(()=>{})}}
                >
                    {'📋'}
                </button>
            </Visibility>
        </div>
    );
}

export { ValueEdit, type ValueEditProps };