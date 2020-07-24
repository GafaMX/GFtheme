'use strict';

import React from "react";
import StaffItem from "./StaffItem";
// import Strings from "../utils/Strings/Strings_ES";
// import PaginationList from "../utils/PaginationList";
import GafaFitSDKWrapper from "../utils/GafaFitSDKWrapper";
import GlobalStorage from "../store/GlobalStorage";

import Slider from "react-slick";
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

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
            jobList: [],
            sliderRows: 1,
            currentjob: 'Todos',
        };
        this.change = this.change.bind(this);
        this.updateRows = this.updateRows.bind(this);

        GlobalStorage.addSegmentedListener(['currentLocation'], this.updateStaffList.bind(this));
    }

    componentDidMount(){
        this.updateRows();
    }

    updateStaffList(){
        let component = this;
        let currentLocation = GlobalStorage.get('currentLocation');

        GafaFitSDKWrapper.getStaffListWithoutBrand(
            currentLocation.brand.slug,
            {
                per_page: 1000,
            }, function (result) {
                component.setState({
                    list: result.data
                });
                component.updateRows();
        });

    }

    updatePaginationData(result) {
        this.setState({
            list: result.data,
            // currentPage: result.current_page
        })
    }

    updateRows() {
        let comp = this;
        let classes = comp.state.list.length;
        if (classes < 10 ){
            comp.setState({ 
                sliderRows : 1,
            });
        } else if (classes >= 10 ){
            comp.setState({ 
                sliderRows : 2,
            });
        }
    }

    change(event) {
        this.setState({currentjob: event.target.value});
    }


    render() {
        let listItems = [];
        this.state.list.forEach((staff) => {
            if ((this.state.currentjob === 'Todos' || staff.job != null && staff.job.toUpperCase() === this.state.currentjob)
                && (staff.status != "inactive")
                && (staff.hide_in_home != true)
            )
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

        let settings = {
            arrows: false,
            dots: true,
            infinite: false,
            speed: 500,
            rows: this.state.sliderRows,
            slidesToScroll: 5,
            slidesToShow: 5,
            responsive: [
                {
                    breakpoint: 481,
                    settings: {
                        rows: 1,
                        slidesToShow: 1,
                        slidesToScroll: 1,
                    }
                },
                {
                    breakpoint: 769,
                    settings: {
                        rows: 1,
                        slidesToShow: 2,
                        slidesToScroll: 2,
                    }
                },
                {
                    breakpoint: 1025,
                    settings: {
                        rows: 1,
                        slidesToShow: 3,
                        slidesToScroll: 3,
                    }
                },
            ],
        };

        return (
            <div className={staffClass}>
                <div className={staffClass + '__header'}>
                    <div className={filterClass}>
                        <div className={filterClass + '__item ' + formClass + '__section ' + (this.state.jobList.length <= 1 ? 'is-empty' : '' )}>
                        <select className={formClass + '__select' + ' is-service-filter'} onChange={this.change} value={this.state.currentjob}>
                            <option>Todos</option>
                            {this.state.jobList.map(job => {
                                return <option key={job} value={job}>{job}</option>
                            })}
                        </select>
                        </div>
                    </div>
                </div>
                <div className={staffClass + '__body'}>
                    <Slider {...settings}>
                        {listItems}
                    </Slider>
                </div>

                {/* <PaginationList page={this.state.currentPage} perpage={this.props.perPage}
                                allpages={this.props.lastPage} itemsList={this.props.total}
                                updatePaginationData={this.updatePaginationData.bind(this)}
                                getListData={GafaFitSDKWrapper.getStaffList}/> */}
            </div>
        );
    }
}

export default StaffList;