'use strict';

import {capturePasswordResetLink} from "./components/utils/passwordResetLink";

// First webpack entry: snapshot ?token=&email= (or the hash gafa.fit
// produces) before the rest of the SDK bundle evaluates and before
// initValues() waits on /brands. Partner scripts in <head> (Weglot,
// TranslatePress) may already have run; sessionStorage keeps the params
// even if they then rewrite location.
capturePasswordResetLink();
