import * as d3 from 'd3';
import moment from 'moment';

const intervalFile = id => `data/project_members/project_members-interval-${id}.json`;

const highestSpeed = 500; // Max speed is ticking each 0.5 seconds
const lowestSpeed = 4000; // Lowest speed is 4 seconds

class Timelapse {
    constructor(network, intervals, locales, options) {
        this.network = network;
        this.intervals = intervals;
        this.locales = locales;
        this.options = options;
        this.timer = null;

        moment.locale(locales.lang);
    }

    create() {
        this.button = this.options.append("button")
            .text(this.locales.message("timelapse"))
            .on("click", () => { this.toggle(); });
    }

    toggle() {
        if (this.timer) {
            this.stop();
        }
        else {
            this.start();
        }
    }

    makeTimer() {
        this.timer = d3.interval(() => { this.tick(); }, this.speed, d3.now());
    }

    start() {
        this.button.text(this.locales.message("timelapse-complete"));

        this.options.selectAll('.regular-option')
            .attr('disabled', true);

        // Initialize the timelapse
        this.network.startTimelapse(intervalFile(this.intervals[9]));

        // Create the heading for the date indication
        this.options.append('h3')
            .classed('timelapse-option', true);

        this.index = 0;
        this.paused = false;
        this.speed = 1500; // Default speed is one tick per 1.5 seconds. Lower is faster.

        // Start the timelapse
        this.tick();
        this.makeTimer();

        // Add a play/pause button to the timelapse
        this.options.append("button")
            .classed("timelapse-option", true)
            .attr("id", "pauseButton")
            .text("❚❚")
            .attr('title', this.locales.message('pause-title'))
            .on("click", () => { this.togglePlayPause(); });

        this.options.append("button")
            .attr("class", "speedButton slower timelapse-option")
            .text("-")
            .attr('title', this.locales.message('speed-slower-title'))
            .on("click", () => { this.decreaseSpeed(); });

        this.options.append("button")
            .attr("class", "speedButton faster timelapse-option")
            .text("+")
            .attr('title', this.locales.message('speed-faster-title'))
            .on("click", () => { this.increaseSpeed(); });

        // Keyboard shortcuts for timelapse options
        Mousetrap.bind(['+', '=', 'plus'], () => { this.increaseSpeed(); });
        Mousetrap.bind('-', () => { this.decreaseSpeed(); });
        Mousetrap.bind('0', () => { this.togglePlayPause(); });
    }

    // This callback will be invoked for each timer tick
    tick() {
        if (this.paused) {
            this.timer.stop();
        }
        else if (this.index < this.intervals.length) {
            let d = new Date(0);
            d.setUTCSeconds(this.intervals[this.index]);

            this.options.select('h3').text(`${moment(d).format('MMMM YYYY')}`);

            this.network.timelapseTick(intervalFile(this.intervals[this.index]), moment(d));

            this.index++;
        }
        else {
            this.options.select('#pauseButton')
                .attr('disabled', true)
                .attr('title', this.locales.message('stop-title'))
                .text('■');
        }
    }

    // Toggles the play/pause setting
    togglePlayPause() {
        if (this.paused) {
            this.paused = false;
            this.tick();
            this.makeTimer();
            this.options.select("#pauseButton").text('❚❚')
                .attr('title', this.locales.message('pause-title'));
        } else {
            this.paused = true;
            this.options.select("#pauseButton").text('►')
                .attr('title', this.locales.message('play-title'));
        }
    }

    // Increase the timelapse speed one step, if below theshold
    increaseSpeed() {
        if (this.speed > highestSpeed) {
            this.speed -= 500;
            this.timer.stop();
            this.makeTimer();

            if (this.speed < lowestSpeed) {
                this.options.select(".speedButton.slower")
                    .attr("disabled", null);
            }
        } else {
            this.options.select(".speedButton.faster")
                .attr("disabled", true);
        }
    }

    // Decrease the timelapse speed one step, if above threshold
    decreaseSpeed() {
        if (this.speed < lowestSpeed) {
            this.speed += 500;
            this.timer.stop();
            this.makeTimer();

            if (this.speed > highestSpeed) {
                this.options.select(".speedButton.faster")
                    .attr("disabled", null);
            }
        } else {
            this.options.select(".speedButton.slower")
                .attr("disabled", true);
        }
    }

    stop() {
        this.timer.stop();
        this.timer = null;

        this.button.text(this.locales.message("timelapse"));

        this.options.selectAll('.regular-option')
            .attr('disabled', null);
        this.options.selectAll('.timelapse-option')
            .remove();

        this.network.stopTimelapse();
        this.network.create();
    }
}

export default Timelapse;
