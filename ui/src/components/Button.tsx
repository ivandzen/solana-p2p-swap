import React, {FC} from "react";

interface ButtonProps {
    name: string,
    className: string,
    onClick: ()=>void,
}
const Button: FC<ButtonProps> = (props) => {
    return (
        <button className={props.className} onClick={props.onClick}>{props.name}</button>
    )
}

export {Button, type ButtonProps}