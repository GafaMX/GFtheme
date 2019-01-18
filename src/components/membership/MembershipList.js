'use strict';

import React from "react";
import MembershipItem from "./MembershipItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import LoginRegister from "../menu/LoginRegister";

class MembershipList extends React.Component {
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
        const listItems = this.props.list.map((membership) =>
            <MembershipItem key={membership.id} membership={membership} setShowLogin={this.setShowLogin.bind(this)}/>
        );
        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.MEMBERSHIPS}</h1>
                <div className={["membership-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>
                </div>
                {this.state.showLogin && <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>}
                <PaginationList page={this.props.currentPage} perpage={this.props.perPage}
                                allpages={this.props.lastPage} itemsList={this.props.total}/>
            </div>);
    }
}

export default MembershipList;

