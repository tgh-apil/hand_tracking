<script>
	import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
	import '@tensorflow/tfjs-backend-webgl';
	import { handData } from './stores.js';
	import Plotly from 'plotly.js-dist-min';

	let model = handPoseDetection.SupportedModels.MediaPipeHands;

	let detectorConfig = {
		runtime: 'mediapipe',
		solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
		modelType: 'full'
	};

	let inputVideo;
	let canvas;
	let detector;

	let leftHand, rightHand;
	let leftHandLabel, rightHandLabel;
	let pointCount = 0;
	let doubleHandCount = 0;
	let oneHandCount = 0;

	let isPlaying = false;
	let currentPos = 0;

	let rightTrackedX = [];
	let rightTrackedY = [];
	let rightTrackedZ = [];

	let leftTrackedX = [];
	let leftTrackedY = [];
	let leftTrackedZ = [];

	let rightVecMagSum = 0;
	let leftVecMagSum = 0;

	let rightTrackedVecMag = [];
	let leftTrackedtVecMag = [];

	let leftSlope = 0;
	let rightSlope = 0;

	let displayData = false;

	async function main() {
		$handData = [...[]];

		detector = await handPoseDetection.createDetector(model, detectorConfig);

		inputVideo = document.getElementById('video');

		inputVideo.onloadeddata = function () {
			console.log('data loaded');
		}

		canvas = document.getElementById('video-canvas');
	}

	// sets which part of the hand we are tracking
	let handPointIdx = 8;

	async function loadVidData() {
		let hands = await detector.estimateHands(inputVideo);

		// handle only seeing one hand and mis-labeling
		if (hands.length < 2) {
			console.log('only seeing 1 hand in scene: skipping');

			oneHandCount += 1;

			// clear any drawings on the video
		} else {
			if (hands[0].handedness == hands[1].handedness) {
			console.log('same hand detected twice: skipping')

			doubleHandCount += 1;

			// clear any drawings on the video
			} else {
				if (hands[0].handedness == 'Right') {
					rightHand = hands[0];
					leftHand = hands[1];

					// console.log(hands[0]);
				} else {
					rightHand = hands[1];
					leftHand = hands[0];
				}

				rightTrackedX.push(rightHand.keypoints3D[handPointIdx].x);
				rightTrackedY.push(rightHand.keypoints3D[handPointIdx].y);
				rightTrackedZ.push(rightHand.keypoints3D[handPointIdx].z);

				leftTrackedX.push(leftHand.keypoints3D[handPointIdx].x);
				leftTrackedY.push(leftHand.keypoints3D[handPointIdx].y);
				leftTrackedZ.push(leftHand.keypoints3D[handPointIdx].z);

				setTimeout(drawOnVideo, 300);

				pointCount += 1;

				leftHandLabel = `${leftHand.handedness} ${leftHand.keypoints3D[handPointIdx].name}`;
				rightHandLabel = `${rightHand.handedness} ${rightHand.keypoints3D[handPointIdx].name}`;

				$handData = [...$handData, {
					pointCount: {
						left: {
							'x': leftHand.keypoints3D[handPointIdx].x,
							'y': leftHand.keypoints3D[handPointIdx].y,
							'z': leftHand.keypoints3D[handPointIdx].z,
						},
						right: {
							'x': rightHand.keypoints3D[handPointIdx].x,
							'y': rightHand.keypoints3D[handPointIdx].y,
							'z': rightHand.keypoints3D[handPointIdx].z,
						},
					}
				}]
			}
		}
	}

	function videoControls() {
		if (isPlaying) {
			inputVideo.pause();
		} else {
			inputVideo.play();
			inputVideo.ontimeupdate = function() {
				currentPos = inputVideo.currentTime;
				currentPos = currentPos.toFixed(2);
					
				loadVidData();
			};
		}

		isPlaying = !isPlaying;
	}

	function drawOnVideo() {
		let ctx = canvas.getContext('2d');
		
		canvas.width = inputVideo.videoWidth;
		canvas.height = inputVideo.videoHeight;

		ctx.drawImage(inputVideo, 0, 0, canvas.width, canvas.height);

		ctx.beginPath();
		ctx.arc(rightHand.keypoints[handPointIdx].x, rightHand.keypoints[handPointIdx].y, 5, 0, 2 * Math.PI);
		ctx.fillStyle = 'red';
		ctx.fill();
		ctx.closePath();

		ctx.beginPath();
		ctx.arc(leftHand.keypoints[handPointIdx].x, leftHand.keypoints[handPointIdx].y, 5, 0, 2 * Math.PI);
		ctx.fillStyle = 'blue';
		ctx.fill();
		ctx.closePath();

		setTimeout(drawOnVideo, 100);
	}

	// from : https://www.aspsnippets.com/Articles/Download-JSON-object-Array-as-File-from-Browser-using-JavaScript.aspx
	function exportData() {

		let data = JSON.stringify($handData, null, "\t");
		data = [data];

		let blob1 = new Blob(data, { type: 'text/plain;charset=utf-8'})

		let url = window.URL || webkitURL;
		let link = url.createObjectURL(blob1);
		let a = document.createElement('a');
		a.download = 'data.txt';
		a.href = link;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		displayData = true;
		generateGraph();
	}

	main();

	function calcLineOfBestFit(xData, yData, hand) {
		// test data
		// let xs = [10, 20, 30, 40, 50];
		// let ys = [1, 2, 3, 4, 5];
		// return y = 0.1x + 0;

		let xs = xData;
		let ys = yData;

		let xSum = 0;
		let ySum = 0;

		for (let i = 0; i < xs.length; i++) {
			xSum = xSum + xs[i];
			ySum = ySum + ys[i];
		}
		
		let xAvg = xSum / xs.length;
		let yAvg = ySum / ys.length;

		let sumSquareX = 0;

		for (let i = 0; i < xs.length; i++) {
			sumSquareX = sumSquareX + Math.pow(xs[i] - xAvg, 2);
		}

		let sumProd = 0;

		for (let i = 0; i < xs.length; i++) {
			sumProd = sumProd + (xs[i] - xAvg) * (ys[i] - yAvg);
		}

		let slope = sumProd / sumSquareX;
		let yInt = yAvg - (slope * xAvg);

		if (hand == 'right') {
			rightSlope = slope;
		} else {
			leftSlope = slope;
		}

		console.log(`hand: ${hand}, xSum: ${xSum}, ySum: ${ySum}, xAvg: ${xAvg}, yAvg: ${yAvg}, sumSquareX: ${sumSquareX}, sumProd: ${sumProd}`);
		console.log(`hand: ${hand}, slope: ${slope}, y-int: ${yInt}`);
	}

	function generateGraph() {
		// for time gradient
		let timePoints = [];

		for (let i = 0; i < pointCount - 1; i++) {
			timePoints.push(i);

			let deltarightTrackedX = Math.pow(rightTrackedX[i + 1] - rightTrackedX[i], 2);
			let deltarightTrackedY = Math.pow(rightTrackedY[i + 1] - rightTrackedY[i], 2);
			let deltarightTrackedZ = Math.pow(rightTrackedZ[i + 1] - rightTrackedZ[i], 2);

			rightVecMagSum = rightVecMagSum + Math.sqrt(deltarightTrackedX + deltarightTrackedY + deltarightTrackedZ);
			rightTrackedVecMag.push(rightVecMagSum);

			let deltaleftTrackedX = Math.pow(leftTrackedX[i + 1] - leftTrackedX[i], 2);
			let deltaleftTrackedY = Math.pow(leftTrackedY[i + 1] - leftTrackedY[i], 2);
			let deltaleftTrackedZ = Math.pow(leftTrackedZ[i + 1] - leftTrackedZ[i], 2);
			
			leftVecMagSum = leftVecMagSum + Math.sqrt(deltaleftTrackedX + deltaleftTrackedY + deltaleftTrackedZ);
			leftTrackedtVecMag.push(leftVecMagSum);
		}

		calcLineOfBestFit(rightTrackedVecMag, timePoints, 'right');
		calcLineOfBestFit(leftTrackedtVecMag, timePoints, 'left');

		let rightTrackedVecMagData = {
			x: timePoints,
			y: rightTrackedVecMag,
			name: `${rightHandLabel}: Total Distance Travelled`,
			marker: {
				color: 'red',
				size: 3,
				symbol: 'square',
				line: {
					color: 'red',
					width: '0.75'
				},
				opacity: 1.0
			},
			mode: 'lines+markers',
			type: 'scatter',
			xaxis: 'x4',
			yaxis: 'y4',
		}

		let leftTrackedVectorMagData = {
			x: timePoints,
			y: leftTrackedtVecMag,
			name: `${leftHandLabel}: Total Distance Travelled`,
			marker: {
				color: 'blue',
				size: 3,
				symbol: 'square',
				line: {
					color: 'blue',
					width: '0.75'
				},
				opacity: 1.0
			},
			mode: 'lines+markers',
			type: 'scatter',
			xaxis: 'x3',
			yaxis: 'y3',
		}

		let rightTrackedData = {
			x: rightTrackedX,
			y: rightTrackedY,
			z: rightTrackedZ,
			name: `${rightHandLabel}`,
			marker: {
				color: timePoints,
				colorscale: 'Reds',
				size: 3,
				symbol: 'circle',
				opacity: 0.8
			},
			mode: 'markers',
			type: 'scatter3d',
			scene: 'scene',
		};
	
		let leftTrackedData = {
			x: leftTrackedX,
			y: leftTrackedY,
			z: leftTrackedZ,
			name: `${leftHandLabel}`,
			marker: {
				color: timePoints,
				colorscale: 'Blues',
				size: 3,
				opacity: 0.8
			},
			mode: 'markers',
			type: 'scatter3d',
			scene: 'scene'
		};

		let data = [leftTrackedVectorMagData, rightTrackedVecMagData, leftTrackedData, rightTrackedData];

		let layout = {
			scene: {
				aspectMode: 'cube',
				domain: {row: 0, column: 0}
			},

			scene2: {
				aspectMode: 'cube',
				domain: {row: 0, column: 1}
			},

			grid: {rows: 2, columns: 2, pattern: 'independent'},
		};

		let config = {
			responsive: true,
		}
	
		let scatter3DPlot = document.getElementById('3dPlot');

		Plotly.newPlot(scatter3DPlot, data, layout, config);
	}

	let videoSRC = 'control_test_clipped.mp4';
	
</script>

<main>
	<body>
		<div id='3dPlot' />
	</body>
	<div>
		<h2>Video Current Position: { currentPos }s</h2>
		<button on:click={ videoControls }>
			{ #if isPlaying }
				Pause
			{ :else }
				Play
			{ /if }
		</button>
		<button on:click={ exportData }>Export Data</button>
		{#if displayData}
			<h2>Number of Available Data Points: { pointCount }</h2>
			<h2>Number of Double Hands Discarded: { doubleHandCount }</h2>
			<h2>Number of Single Hands Discarded: { oneHandCount }</h2>
			<h2>{ leftHandLabel } Slope: { leftSlope.toFixed(2) }</h2>
			<h2>{ rightHandLabel } Slope: { rightSlope.toFixed(2) }</h2>
		{:else}
			<h2>No Data to Display</h2>
			<div>
				<video id='video' muted>
					<source src={ videoSRC } type="video/mp4">
				</video>
				<canvas id='video-canvas'></canvas>
			</div>
		{/if}
	</div>
</main>

<style>

	video {
		display: none;
	}

</style>