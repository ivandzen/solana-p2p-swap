import React from "react";
import {FC} from "react";
import {Button, ButtonProps} from "./Button";
import {ValueEdit, ValueEditProps} from "./ValueEdit";

interface ButtonEditBoxProps {
    className: string,
    buttonProps: ButtonProps,
    valeEditProps: ValueEditProps,
}

const ButtonEditBox: FC<ButtonEditBoxProps> = (props) => {
    return (
        <div className={props.className}>
            <ValueEdit
                name={props.valeEditProps.name}
                onChange={props.valeEditProps.onChange}
                valueChecker={props.valeEditProps.valueChecker}
                size={props.valeEditProps.size}
                readonly={props.valeEditProps.readonly}
                value={props.valeEditProps.value}
            />
            <Button
                name={props.buttonProps.name}
                className={props.buttonProps.className}
                onClick={props.buttonProps.onClick}
            />
        </div>
    )
}

export {ButtonEditBox, type ButtonEditBoxProps}