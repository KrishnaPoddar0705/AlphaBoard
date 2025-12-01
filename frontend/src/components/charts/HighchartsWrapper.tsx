import React from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import IndicatorsCore from 'highcharts/indicators/indicators';
import VBP from 'highcharts/indicators/volume-by-price';
import MACD from 'highcharts/indicators/macd';
import RSI from 'highcharts/indicators/rsi';
import EMA from 'highcharts/indicators/ema';
import BollingerBands from 'highcharts/indicators/bollinger-bands';
import DragPanes from 'highcharts/modules/drag-panes';
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced';
import PriceIndicator from 'highcharts/modules/price-indicator';
import FullScreen from 'highcharts/modules/full-screen';
import StockTools from 'highcharts/modules/stock-tools';
import 'highcharts/css/stocktools/gui.css';
import 'highcharts/css/highcharts.css';

// Helper to initialize modules safely
const initModule = (module: any) => {
    if (typeof module === 'function') {
        module(Highcharts);
    } else if (typeof module === 'object' && module.default) {
        module.default(Highcharts);
    }
};

// Initialize modules
initModule(IndicatorsCore);
initModule(VBP);
initModule(MACD);
initModule(RSI);
initModule(EMA);
initModule(BollingerBands);
initModule(DragPanes);
initModule(AnnotationsAdvanced);
initModule(PriceIndicator);
initModule(FullScreen);
initModule(StockTools);

// Set global Highcharts options to disable label backgrounds
Highcharts.setOptions({
    chart: {
        style: {
            fontFamily: 'inherit'
        }
    },
    xAxis: {
        labels: {
            style: {
                color: '#94a3b8'
            }
        }
    },
    yAxis: {
        labels: {
            style: {
                color: '#94a3b8'
            }
        }
    }
});

interface HighchartsChartProps {
    type: string;
    data: any[];
    options?: any;
    technicalType?: 'line' | 'candlestick';
    customDateRange?: { start: string; end: string };
}

export const HighchartsChart: React.FC<HighchartsChartProps> = ({ type, data, options, technicalType = 'line', customDateRange }) => {
    const isStock = type.includes('Stock') || type.includes('Candlestick') || type.includes('OHLC') || type.includes('Technical');
    
    // Transform data for Highcharts Stock (OHLCV)
    // Highcharts Stock expects sorted array of arrays: [timestamp, open, high, low, close, volume]
    // Or specific data arrays if using multiple series
    
    // Prepare OHLC data
    const ohlc = data.map(item => [
        new Date(item.date).getTime(),
        item.open,
        item.high,
        item.low,
        item.close
    ]).sort((a, b) => a[0] - b[0]);

    // Prepare Close price data for line chart
    const closePrice = data.map(item => [
        new Date(item.date).getTime(),
        item.close
    ]).sort((a, b) => a[0] - b[0]);

    const volume = data.map(item => [
        new Date(item.date).getTime(),
        item.volume
    ]).sort((a, b) => a[0] - b[0]);

    const defaultOptions: Highcharts.Options = {
        chart: {
            backgroundColor: '#0f172a',
            plotBackgroundColor: '#0f172a',
            style: {
                fontFamily: 'inherit',
                color: '#e2e8f0'
            },
            height: 550,
            marginLeft: null,
            marginRight: null,
            spacingLeft: 0,
            spacingRight: 0,
            spacingTop: 10,
            spacingBottom: 10
        },
        exporting: {
            enabled: false
        },
        rangeSelector: {
            selected: 4, // Default to 1y or All
            inputEnabled: false,
            buttonTheme: {
                fill: 'none',
                stroke: 'none',
                'stroke-width': 0,
                r: 8,
                style: {
                    color: '#94a3b8',
                    fontWeight: 'bold'
                },
                states: {
                    hover: {
                        fill: '#334155',
                        style: {
                            color: 'white'
                        }
                    },
                    select: {
                        fill: '#4f46e5',
                        style: {
                            color: 'white'
                        }
                    }
                }
            },
            buttons: [{
                type: 'month',
                count: 1,
                text: '1m'
            }, {
                type: 'month',
                count: 3,
                text: '3m'
            }, {
                type: 'month',
                count: 6,
                text: '6m'
            }, {
                type: 'ytd',
                text: 'YTD'
            }, {
                type: 'year',
                count: 1,
                text: '1y'
            }, {
                type: 'all',
                text: 'All'
            }]
        },
        title: {
            text: undefined
        },
        xAxis: {
            gridLineColor: '#334155',
            lineColor: '#334155',
            tickColor: '#334155',
            offset: 0,
            labels: {
                style: { color: '#94a3b8' },
                useHTML: false,
                backgroundColor: 'transparent',
                borderWidth: 0
            },
            crosshair: {
                color: '#475569',
                dashStyle: 'Dash',
                width: 1,
                label: {
                    enabled: false
                }
            },
            plotLines: customDateRange ? [
                {
                    color: '#3b82f6', // Blue
                    width: 2,
                    value: new Date(customDateRange.start).getTime(),
                    dashStyle: 'Dash',
                    label: {
                        text: 'Start',
                        style: { color: '#3b82f6' }
                    }
                },
                {
                    color: '#3b82f6', // Blue
                    width: 2,
                    value: new Date(customDateRange.end).getTime(),
                    dashStyle: 'Dash',
                    label: {
                        text: 'End',
                        style: { color: '#3b82f6' }
                    }
                }
            ] : []
        },
        yAxis: [{
            labels: {
                align: 'right',
                x: -3,
                style: { color: '#94a3b8' },
                useHTML: false,
                backgroundColor: 'transparent',
                borderWidth: 0
            },
            title: {
                text: 'OHLC',
                style: { color: '#94a3b8' },
                align: 'high',
                rotation: 0,
                offset: 0,
                y: -10
            },
            height: '60%',
            lineWidth: 2,
            gridLineColor: '#334155',
            offset: 0,
            left: null,
            crosshair: {
                color: '#475569',
                dashStyle: 'Dash',
                width: 1,
                label: {
                    enabled: false
                }
            },
            resize: {
                enabled: true
            }
        }, {
            labels: {
                align: 'right',
                x: -3,
                style: { color: '#94a3b8' },
                useHTML: false,
                backgroundColor: 'transparent',
                borderWidth: 0
            },
            title: {
                text: 'Volume',
                style: { color: '#94a3b8' },
                align: 'high',
                rotation: 0,
                offset: 0,
                y: -10
            },
            top: '65%',
            height: '35%',
            offset: 0,
            left: null,
            lineWidth: 2,
            gridLineColor: '#334155',
            crosshair: {
                color: '#475569',
                dashStyle: 'Dash',
                width: 1,
                label: {
                    enabled: false
                }
            }
        }],
        plotOptions: {
            candlestick: {
                color: '#ef4444',
                upColor: '#10b981',
                lineColor: '#ef4444',
                upLineColor: '#10b981'
            },
            line: {
                color: '#3b82f6', // Blue line as requested
                lineWidth: 2
            }
        },
        series: [
            {
                type: technicalType === 'candlestick' ? 'candlestick' : 'line',
                name: 'Price',
                id: 'price',
                data: technicalType === 'candlestick' ? ohlc : closePrice,
            },
            {
                type: 'column',
                name: 'Volume',
                id: 'volume',
                data: volume,
                yAxis: 1,
                color: '#6366f1'
            }
        ],
        tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            borderColor: '#475569',
            borderWidth: 1,
            style: {
                color: '#e2e8f0',
                fontSize: '12px'
            },
            split: true,
            shared: true
        },
        navigator: {
            maskFill: 'rgba(15, 23, 42, 0.3)',
            outlineColor: '#475569',
            outlineWidth: 1,
            handles: {
                backgroundColor: '#334155',
                borderColor: '#94a3b8'
            },
            xAxis: {
                gridLineColor: '#334155',
                labels: {
                    style: { color: '#94a3b8' }
                }
            },
            series: {
                color: '#3b82f6',
                lineColor: '#3b82f6'
            }
        },
        scrollbar: {
            enabled: false
        },
        legend: {
            enabled: false,
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            itemStyle: {
                color: '#94a3b8'
            },
            itemHoverStyle: {
                color: '#ffffff'
            }
        },
        credits: {
            enabled: true,
            style: {
                color: '#64748b'
            }
        },
        stockTools: {
            gui: {
                enabled: false
            }
        },
        navigation: {
            bindings: {
                enabled: false
            }
        },
        ...options
    };

    return (
        <div className="w-full highcharts-dark-theme" style={{ minHeight: '500px', height: 'auto', width: '100%', margin: 0, padding: 0 }}>
            <HighchartsReact
                highcharts={Highcharts}
                constructorType={'stockChart'}
                options={defaultOptions}
                containerProps={{ 
                    style: { 
                        height: '100%', 
                        width: '100%', 
                        minHeight: '500px',
                        margin: 0,
                        padding: 0,
                        display: 'block'
                    } 
                }}
            />
        </div>
    );
};
