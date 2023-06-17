import React, {FC, useEffect, useState} from "react";

interface ButtonProps {
    name: string,
    onClick: ()=>void,
    checkable?: boolean,
    checked?: boolean,
    setChecked?: (chck: boolean) => void,
    disabled?: boolean,
}
const Button: FC<ButtonProps> = (props) => {
    let initialStyle = "tabbutton";

    if (props.checkable) {
        if (props.checked) {
            initialStyle = "tabbutton-active";
        } else {
            initialStyle = "tabbutton";
        }
    } else {
        initialStyle = "tabbutton-active";
    }

    const [style, setStyle] = useState<string>(initialStyle);

    const onButtonClick = () => {
        if (props.checkable) {
            if (!props.setChecked) {
                throw("Wrong Button configuration: button is checkable but dont have setChecked callback");
            }

            if (props.checked) {
                props.setChecked(false);
                setStyle("tabbutton");
            } else {
                props.setChecked(true);
                setStyle("tabbutton-active");
            }
        }

        props.onClick();
    }

    return (
        <button disabled={props.disabled} className={style} onClick={onButtonClick}>{props.name}</button>
    )
}

export {Button, type ButtonProps}