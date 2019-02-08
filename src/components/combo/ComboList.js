'use strict';

import React from "react";
import ComboItem from "./ComboItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import LoginRegister from "../menu/LoginRegister";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class ComboList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.list,
            currentPage: this.props.currentPage,
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

    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page
        })
    }

    render() {
        const listItems = this.state.list.map((combo) =>
            <ComboItem key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
        );
        return (
            <div>
                <h1 className={["section-title", "container", "text-center"].join(" ")}>{Strings.COMBOS}</h1>
                <hr></hr>
                <div className={["combo-list", "container"].join(" ")}>
                    <div className={["row", "mt-5"].join(" ")}>
                        {listItems}
                    </div>
                </div>
                <PaginationList page={this.state.currentPage} perpage={this.props.perPage}
                                allpages={this.props.lastPage} itemsList={this.props.total}
                                updatePaginationData={this.updatePaginationData.bind(this)}
                                getListData={GafaFitSDKWrapper.getComboList}
                                extraOptions={this.state.extraPaginationOptions}/>
                {this.state.showLogin &&
                <LoginRegister setShowLogin={this.setShowLogin.bind(this)}/>
                }
            </div>
        );
    }
}

export default ComboList;

