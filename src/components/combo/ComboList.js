'use strict';

import React from "react";
import ComboItem from "./ComboItem";
import Login from "../auth/Login";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";

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
        let layoutToReturn =
            <div >
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.COMBOS}</h1>
                <div className={["combo-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}

                    </div>

                </div>
                        {/*Paginacion*/}
                        {/*<span>{this.props.currentPage}</span><br/>*/}
                        {/*<span>{this.props.perPage}</span><br/>*/}
                        {/*<span>{this.props.lastPage}</span>*/}
                <PaginationList  page={this.props.currentPage} perpage={this.props.perPage} allpages={this.props.lastPage} itemsList={this.props.total}/>
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

