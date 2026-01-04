// StockChart component - Legacy react-stockcharts is not compatible with React 19
// This component is kept for reference but uses Highcharts as fallback

const StockChartWrapped = (_props: any) => {
    return <div className="text-red-500 p-4">Legacy Chart Error. Please switch to Highcharts view.</div>;
};

export default StockChartWrapped;
