'use strict';

import React from "react";
import StaffProwessItem from "./StaffProwessItem";
import PaginationList from "../../utils/PaginationList";
import GafaFitSDKWrapper from "../../utils/GafaFitSDKWrapper";
import './styles/StaffProwess.scss';


export default class StaffProwess extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            staff: this.props.staff,
            list: this.props.staff.list,
            brands: this.props.brands,
            currentPage: this.props.staff.currentPage,
            allpages: this.props.staff.lastPage,
            perpage: this.props.staff.perPage,
            itemsList: this.props.staff.total,
            jobList: [],
            brandList: [],
            currentjob: 'Todos',
            currentBrand: window.GFtheme.brand,
        };
        this.change = this.change.bind(this);
        this.changeBrand = this.changeBrand.bind(this);
    }

    componentDidMount(){
        let {brands} = this.state;
        let currentBrand = brands.find(brand => brand.slug.toLowerCase().includes(window.GFtheme.brand.toLowerCase()));
        this.setState({
            currentBrand: currentBrand,
        })
    }
    updatePaginationData(result) {
        this.setState({
            list: result.data,
            currentPage: result.current_page,
            allpages: result.total,
            perpage: result.per_page,
        })
    }

    change(event) {
        this.setState({currentjob: event.target.value});
    }

    changeBrand(event) {
        let comp = this;
        let {brands} = comp.state;
        let {per_page} = this.props;
        let currentBrand = brands.find(brand => brand.name.toUpperCase().includes(event.target.value));
        this.setState({currentBrand: currentBrand});

        GafaFitSDKWrapper.getStaffListWithBrand(
            currentBrand.slug,
        {
            per_page: per_page,
        }, function (result) {
            comp.setState({
                staff: result,
                list: result.data,
                currentPage : result.current_page,
                allpages: result.total,
                perpage: result.per_page,
            });
        });
    }

    render(){

        let {list} = this.state;

        this.state.brands.map(brand => {
            if (brand != null && !this.state.brandList.includes(brand.name.toUpperCase())){
                this.state.brandList.push(brand.name.toUpperCase());
            }
        });

        const staffList =   list.map((staff) => {
                                if((staff.status != "inactive") && (staff.hide_in_home != true)){
                                    return <StaffProwessItem currentBrand={this.state.currentBrand} key={staff.id} staff={staff}/>;
                                }
                            })

        return (
            <div>
                {/* <div className={'jobSelector classSelector'}>
                    <select className={'col-md-3 form-control'} onChange={this.change} value={this.state.currentjob}>
                        <option>Todos</option>
                        {this.state.jobList.map(job => {
                            return <option key={job} value={job}>{job}</option>
                        })}
                    </select>
                </div> */}

                <div className={'tt_navigation_wrapper'}>
                    <div className={'calendar-filter-selector form-group'}>
                        <select className={'col-md-12 form-control'} onChange={this.changeBrand}>
                            {this.state.brandList.map(brand => {
                                return <option key={brand} value={brand}>{brand}</option>
                            })}
                        </select>
                    </div>
                </div>

                <div className={"qodef-team-list-holder qodef-large-space qodef-tl-four-columns"}>
                    <div className={"qodef-tl-inner qodef-outer-space"}>
                        {
                            staffList
                        }
                    </div>
                </div>

                <PaginationList
                    template={this.props.template}
                    page={this.state.currentPage}
                    perpage={this.state.perpage}
                    allpages={this.state.allpages}
                    currentBrand={this.state.currentBrand}
                    itemsList={this.state.staff.total}
                    updatePaginationData={this.updatePaginationData.bind(this)}
                    getListData={GafaFitSDKWrapper.getStaffListWithBrand}

                />
            </div>
        );
    }
}