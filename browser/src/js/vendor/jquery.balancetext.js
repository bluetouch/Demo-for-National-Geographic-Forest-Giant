/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */
/**
 * jquery.balancetext.js
 *
 * Author: Randy Edmunds
 */

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global jQuery: false */

(function ($) {
    "use strict";

    var style = document.documentElement.style,
        hasTextWrap = (style.textWrap   || style.WebkitTextWrap || style.MozTextWrap || style.MsTextWrap || style.OTextWrap);

    $.fn.balanceText = function () {
        if (hasTextWrap) {
            // browser supports text-wrap, so do nothing
            return this;
        } else {
            return this.each(function () {
                var $this = $(this);

                function NextWS_params() {
                    this.reset();
                }
                NextWS_params.prototype.reset = function () {
                    this.index = 0;
                    this.width = 0;
                };

                /**
                 * Returns true iff c is an HTML space character.
                 */
                var isWS = function (c) {
                    return (" \t\n\r\f".indexOf(c) !== -1);
                };

                var removeBR = function (s) {
                    return s.replace(/<br\s*\/?>/g, " ");
                };

                /**
                 * In the current simple implementation, an index i is a break
                 * opportunity in txt iff it is 0, txt.length, or the
                 * index of a non-whitespace char immediately preceded by a
                 * whitespace char.  (Thus, it doesn't honour 'white-space' or
                 * any Unicode line-breaking classes.)
                 *
                 * @precondition 0 <= index && index <= txt.length
                 */
                var isBreakOpportunity = function (txt, index) {
                    return ((index === 0) || (index === txt.length) ||
                            (isWS(txt.charAt(index - 1)) && !isWS(txt.charAt(index))));
                };

                /**
                 * Finds the first break opportunity (@see isBreakOpportunity)
                 * in txt that's both after-or-equal-to index c in the direction dir
                 * and resulting in line width equal to or past clamp(desWidth,
                 * 0, conWidth) in direction dir.  Sets ret.index and ret.width
                 * to the corresponding index and line width (from the start of
                 * txt to ret.index).
                 *
                 * @param $el      - $(element)
                 * @param txt      - text string
                 * @param conWidth - container width
                 * @param desWidth - desired width
                 * @param dir      - direction (-1 or +1)
                 * @param c        - char index (0 <= c && c <= txt.length)
                 * @param ret      - return object; index and width of previous/next break
                 *
                 */
                var findBreakOpportunity = function ($el, txt, conWidth, desWidth, dir, c, ret) {
                    var w;

                    for(;;) {
                        while (!isBreakOpportunity(txt, c)) {
                            c += dir;
                        }

                        $el.text(txt.substr(0, c));
                        w = $el.width();

                        if ((dir < 0)
                                ? ((w <= desWidth) || (w <= 0) || (c === 0))
                                : ((desWidth <= w) || (conWidth <= w) || (c === txt.length))) {
                            break;
                        }
                        c += dir;
                    }
                    ret.index = c;
                    ret.width = w;
                };

                // reflow() inserts breaks into text to balance text acros multiple lines
                var reflow = function () {

                    // In a lower level language, this algorithm takes time
                    // comparable to normal text layout other than the fact
                    // that we do two passes instead of one, so we should
                    // be able to do without this limit.
                    var maxTextWidth = 5000;

                    $this.html(removeBR($this.html()));        // strip <br> tags
                    var containerWidth = $this.width();
                    var containerHeight = $this.height();

                    // save settings
                    var oldWS = $this.css('white-space');
                    var oldFloat = $this.css('float');
                    var oldDisplay = $this.css('display');
                    var oldPosition = $this.css('position');

                    // temporary settings
                    $this.css({
                        'white-space': 'nowrap',
                        'float': 'none',
                        'display': 'inline',
                        'position': 'static'
                    });

                    var nowrapWidth = $this.width();
                    var nowrapHeight = $this.height();

                    // An estimate of the average line width reduction due
                    // to trimming trailing space that we expect over all
                    // lines other than the last.
                    var guessSpaceWidth = ((oldWS === 'pre-wrap') ? 0 : nowrapHeight / 4);

                    if (containerWidth > 0 &&                  // prevent divide by zero
                            nowrapWidth > containerWidth &&    // text is more than 1 line
                            nowrapWidth < maxTextWidth) {      // text is less than arbitrary limit (make this a param?)

                        var remainingText = $this.text();
                        var newText = "";
                        var totLines = Math.round(containerHeight / nowrapHeight);
                        var remLines = totLines;

                        // Determine where to break:
                        while (remLines > 1) {

                            var desiredWidth = Math.round((nowrapWidth + guessSpaceWidth)
                                                          / remLines
                                                          - guessSpaceWidth);

                            // Guessed char index
                            var guessIndex = Math.round((remainingText.length + 1) / remLines) - 1;

                            var le = new NextWS_params();

                            // Find a breaking space somewhere before (or equal to) desired width,
                            // not necessarily the closest to the desired width.
                            findBreakOpportunity($this, remainingText, containerWidth, desiredWidth, -1, guessIndex, le);

                            // Find first breaking char after (or equal to) desired width.
                            var ge = new NextWS_params();
                            guessIndex = le.index;
                            findBreakOpportunity($this, remainingText, containerWidth, desiredWidth, +1, guessIndex, ge);

                            // Find first breaking char before (or equal to) desired width.
                            le.reset();
                            guessIndex = ge.index;
                            findBreakOpportunity($this, remainingText, containerWidth, desiredWidth, -1, guessIndex, le);

                            // Find closest string to desired length
                            var splitIndex;
                            if (le.index === 0) {
                                splitIndex = ge.index;
                            } else if ((containerWidth < ge.width) || (le.index === ge.index)) {
                                splitIndex = le.index;
                            } else {
                                splitIndex = ((Math.abs(desiredWidth - le.width) < Math.abs(ge.width - desiredWidth))
                                                   ? le.index
                                                   : ge.index);
                            }

                            // Break string
                            newText += remainingText.substr(0, splitIndex);
                            newText += "<br/>";
                            remainingText = remainingText.substr(splitIndex);

                            // update counters
                            remLines--;
                            $this.text(remainingText);
                            nowrapWidth = $this.width();
                        }

                        $this.html(newText + remainingText);
                    }

                    // restore settings
                    $this.css({
                        'position': oldPosition,
                        'display': oldDisplay,
                        'float': oldFloat,
                        'white-space': oldWS
                    });
                };

                // Call once to set.
                reflow();
            });
        }
    };

}(jQuery));
