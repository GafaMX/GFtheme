'use strict';

import React from 'react';
import moment from 'moment';
import {formatMoney} from "../utils/FormatUtils";

class PurchaseItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
         <div className={'purchase-item'}>
            <div className={'purchase-item__header'}>
               <h4 className={'purchase-item-name'}><strong>{this.props.purchase.items[0].item_name}</strong></h4>
            </div>
            <div className={'purchase-item__body'}>
               <p className={'purchase-item-price'}><strong>$ {formatMoney(this.props.purchase.total,0)}</strong></p>
               <p>{moment(this.props.purchase.created_at).calendar()}</p>
            </div>
         </div>
        )
    }
}

export default PurchaseItem;