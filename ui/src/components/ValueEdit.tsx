import React, {ChangeEvent, FC, useState} from "react";

interface ValueEditAttributes {
    name: string,
    onChange?: (value: string) => void;
    valueChecker?: (value: string) => boolean;
    size?: number;
    readonly?: boolean;
    value?: string
}

const ValueEdit: FC<ValueEditAttributes> = (attribs: ValueEditAttributes) => {
    let [value, setValue] = useState(attribs.value ? attribs.value : "");
    let [inputStyle, setInputStyle] = useState(attribs.readonly ? "input-readonly" : "input");
    let checkValue = (event: ChangeEvent<HTMLInputElement>) => {
        let eventValue = event.target.value;
        if (attribs.valueChecker && attribs.valueChecker(eventValue)) {
            setInputStyle("input");
            if (attribs.onChange)
                attribs.onChange(eventValue);
        } else {
            setInputStyle("input-failed");
        }

        setValue(eventValue);
    };

    return (
        <div className="value-edit">
            <label><b>{attribs.name}</b></label>
            <input
                className={inputStyle}
                onChange={checkValue}
                size={attribs.size ? attribs.size : 43}
                readOnly={attribs.readonly ? attribs.readonly : false}
                value={value}
            />
        </div>
    );
}

export { ValueEdit };