import React from 'react';
import {FC} from 'react';
import AnimateHeight from "react-animate-height";

interface TabProps {
    isActive: boolean,
    children: any,
}
const Visibility: FC<TabProps> = (props) => {
    return (
        <AnimateHeight height={props.isActive ? 'auto' : 0} duration={500}>
                {props.children}
        </AnimateHeight>
    )
}

export {type TabProps, Visibility};