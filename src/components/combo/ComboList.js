'use strict';

import React from "react";
import ComboItem from "./ComboItem";
import Login from "../auth/Login";

class ComboList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false
        };
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    render() {
        const listItems = this.props.list.map((combo) =>
            <ComboItem key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
        );
        let layoutToReturn = <div className={["combo-list", "container"].join(" ")}>
            <div className={["row"].join(" ")}>
                {listItems}
            </div>

        </div>;
        if (this.state.showLogin) {
            layoutToReturn = <Login setShowLogin={this.setShowLogin.bind(this)}/>;
        }
        return (
            layoutToReturn
        );
    }
}

export default ComboList;

