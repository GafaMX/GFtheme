'use strict';

import React from "react";
import ComboItem from "./ComboItem";
import Login from "../auth/Login";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class ComboList extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showLogin: false,
            list: this.props.list
        };
    }

    setShowLogin(showLogin) {
        this.setState({
            showLogin: showLogin
        });
    }

    updateList(list)
    {
        this.setState({
            list:list
        });
    }

    render() {
        const listItems = this.state.list.map((combo) =>
            <ComboItem key={combo.id} combo={combo} setShowLogin={this.setShowLogin.bind(this)}/>
        );
        let layoutToReturn =
            <div >
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.COMBOS}</h1>
                <div className={["combo-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}

                    </div>

                </div>
                        {/*Paginacion*/}
                <PaginationList  page={this.props.currentPage} perpage={this.props.perPage}
                                 allpages={this.props.lastPage} itemsList={this.props.total}
                                 updateList={this.updateList.bind(this)}
                                 getListData={GafaFitSDKWrapper.getComboList}/>
            </div>
        ;

        if (this.state.showLogin) {
            layoutToReturn = <Login setShowLogin={this.setShowLogin.bind(this)}/>;
        }
        return (
            layoutToReturn
        );
    }
}

export default ComboList;

