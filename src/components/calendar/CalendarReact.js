import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

class CalendarReact extends React.Component {
  render() {
    const { date_min, date_max } = this.props;

    const minDate = date_min ? new Date(date_min) : null;
    const maxDate = date_max ? new Date(date_max) : null;

    return (
      <Calendar 
      
      minDate={minDate} 
      maxDate={maxDate}
      />
    );
  }
}

export default CalendarReact;
