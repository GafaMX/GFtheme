'use strict';

import React from "react";
import StaffItem from "./StaffItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

class StaffList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: this.props.list,
            jobList: [],
            currentjob: 'Todos',
        };
        this.change = this.change.bind(this);
    }

    updateList(list) {
        this.setState({
            list: list
        });
    }

    change(event) {
        this.setState({currentjob: event.target.value});

    }


    render() {
        let listItems = [];
        this.state.list.forEach((staff) => {
                if (this.state.currentjob === 'Todos' || staff.job != null && staff.job.toUpperCase() === this.state.currentjob)
                    listItems.push(<StaffItem key={staff.id} staff={staff}/>);
            }
        );

        this.state.list.map((staff) => {
                if (staff.job != null && !this.state.jobList.includes(staff.job.toUpperCase())) {
                    this.state.jobList.push(staff.job.toUpperCase());
                }
            }
        );
        return (
            <div>
                <h1 className={["display-4", "container", "text-center"].join(" ")}>{Strings.STAFF_LIST}</h1>
                <div className={'jobSelector'}>
                    <select className={'col-md-5  form-control'} onChange={this.change} value={this.state.currentjob}>
                        <option>Todos</option>
                        {this.state.jobList.map(job => {
                            return <option key={job} value={job}>{job}</option>
                        })}
                    </select>
                </div>

                <div className={["staff-list", "container"].join(" ")}>
                    <div className={["row", "mt-5", "justify-content-center", "text-center"].join(" ")}>
                        {listItems}
                    </div>

                    <PaginationList page={this.props.currentPage} perpage={this.props.perPage}
                                    allpages={this.props.lastPage} itemsList={this.props.total}
                                    updateList={this.updateList.bind(this)}
                                    getListData={GafaFitSDKWrapper.getStaffList}/>
                </div>
            </div>
        );
    }
}

export default StaffList;