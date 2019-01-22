'use strict';

import React from "react";
import MembershipItem from "./MembershipItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import LoginRegister from "../menu/LoginRegister";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class MembershipList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.list,
            extraPaginationOptions: {
                only_actives: true,
                propagate: true,
            }
        };
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    updateList(list) {
        this.setState({
            list: list
        });
    }

    render() {
        const listItems = this.state.list.map((membership) =>
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

                <PaginationList page={this.props.currentPage} perpage={this.props.perPage}
                                allpages={this.props.lastPage} itemsList={this.props.total}
                                updateList={this.updateList.bind(this)}
                                getListData={GafaFitSDKWrapper.getMembershipList}
                                extraOptions={this.state.extraPaginationOptions}/>
                {
                    this.state.showLogin &&
                    <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default MembershipList;

