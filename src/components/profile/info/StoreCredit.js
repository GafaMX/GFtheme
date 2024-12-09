import React from "react";
import StringStore from "../../utils/Strings/StringStore";

export default class StoreCredit extends React.Component {
    constructor(props) {
        super(props);
    }

    get defaultProps() {
        return {
            me: null
        };
    }

    render() {
        let me = this.props.me;

        if (typeof me === 'object' && me.hasOwnProperty('store_credit_total')) {
            return (
                <div className={'storeCreditsUser'}>
                    <p className={'storeCreditsUser-total-label'}>{StringStore.get('STORE_CREDIT_AVAILABLE')}</p>
                    <p className={'storeCreditsUser-total'}>{me.store_credit_total}</p>
                </div>
            )
        } else {
            return null;
        }
    }
}