import React, {FC} from "react";
import { Visibility } from "./Visibility";
import Decimal from "decimal.js";

export interface SimplifiedOrderDescriptionData {
    orderTokenName: string,
    priceTokenName: string,
    price: Decimal,
    minSellAmount: Decimal,
    remainsToFill: Decimal,
    isPrivate: boolean,
}

export interface SimplifiedOrderDescriptionProps {
    data: SimplifiedOrderDescriptionData|null,
}

export const SimplifiedOrderDescription: FC<SimplifiedOrderDescriptionProps> = (props) => {
    return (
        <Visibility isActive={!!props.data}>
            <div className='vertical'>
                <label>{`Selling ${props.data?.orderTokenName} for ${props.data?.price} ${props.data?.priceTokenName}`}</label>
                <label>{`minimal amount to buy is ${props.data?.minSellAmount} ${props.data?.orderTokenName}`}</label>
                <label>{`${props.data?.remainsToFill} ${props.data?.orderTokenName} are left`}</label>
                <Visibility isActive={!!props.data?.isPrivate}>
                    <label className="label-attention">
                        <p>NOTE: This order is private</p>
                        <p>Unlock key is required</p>
                    </label>
                </Visibility>
            </div>
        </Visibility>

    )
}