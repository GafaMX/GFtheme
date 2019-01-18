'use strict';

import React from "react";
import StaffItem from "./StaffItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class StaffList extends React.Component {
    constructor(props) {
        super(props);
        this.state={
            list:this.props.list
        }
    }

    updateList(list)
    {
        this.setState({
            list:list
        });
    }

    render() {
        const listItems = this.state.list.map((staff) =>
            <StaffItem key={staff.id} staff={staff}/>
        );
        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.STAFF_LIST}</h1>
                <div className={["staff-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>
                    {/*Paginacion*/}
                    <PaginationList  page={this.props.currentPage} perpage={this.props.perPage}
                                     allpages={this.props.lastPage} itemsList={this.props.total}
                                     updateList={this.updateList.bind(this)}
                                     getListData={GafaFitSDKWrapper.getStaffList}/>
                </div>
            </div>
        );
    }
}

export default StaffList;