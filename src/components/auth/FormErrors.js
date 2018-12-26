import React from 'react';
import Strings from "../utils/Strings/Strings_ES";

export const FormErrors = ({formErrors}) =>
    <div className='formErrors'>
        {Object.keys(formErrors).map((fieldName, i) => {
            if (formErrors[fieldName].length > 0) {
                return (
                    <p key={i}>{Strings.THE_FIELD} {Strings.TO_VALIDATION[fieldName]} {formErrors[fieldName]}</p>
                )
            } else {
                return '';
            }
        })}
    </div>;