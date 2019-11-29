'use strict';

import React from "react";
import StaffItem from "./StaffItem";
import Strings from "../utils/Strings/Strings_ES";
import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";

// Estilos
import '../../styles/newlook/components/GFSDK-c-StaffServices.scss';
import '../../styles/newlook/components/GFSDK-c-Filter.scss';

import '../../styles/newlook/elements/GFSDK-e-structure.scss';
import '../../styles/newlook/elements/GFSDK-e-form.scss';


class StaffList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: this.props.list,
            currentPage: this.props.currentPage,
            jobList: [],
            currentjob: 'Todos',
        };
        this.change = this.change.bind(this);
    }

    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page
        })
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

        let preC = 'GFSDK-c';
        let preE = 'GFSDK-e';
        let staffClass = preC + '-staffList';
        let filterClass = preC + '-filter';
        let formClass = preE + '-form';

        return (
            <div className={staffClass}>
                <div className={filterClass}>
                    <select className={filterClass + '__item ' + formClass + '__select'} onChange={this.change} value={this.state.currentjob}>
                        <option>Todos</option>
                        {this.state.jobList.map(job => {
                            return <option key={job} value={job}>{job}</option>
                        })}
                    </select>
                </div>
                <div className={staffClass + '__container'}>
                    {listItems}
                </div>

                    <PaginationList page={this.state.currentPage} perpage={this.props.perPage}
                                    allpages={this.props.lastPage} itemsList={this.props.total}
                                    updatePaginationData={this.updatePaginationData.bind(this)}
                                    getListData={GafaFitSDKWrapper.getStaffList}/>
            </div>
        );
    }
}

export default StaffList;