'use strict';

import React from "react";
import ComboItem from "./ComboItem";
import Login from "../auth/Login";
import Strings from "../utils/Strings/Strings_ES";
import LoginRegister from "../menu/LoginRegister";

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
        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.COMBOS}</h1>
                <div className={["combo-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>
                </div>
                {this.state.showLogin &&
                <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
                {/*<div className="loading-mask">*/}
                    {/*<div className="circle-loading"></div>*/}
                {/*</div>*/}
            </div>
        );

    }
}

export default ComboList;

