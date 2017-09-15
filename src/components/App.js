import '../assets/css/App.css';
import React, { Component } from 'react';
import { Fabric } from 'office-ui-fabric-react/lib/Fabric';
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar';
import { IContextualMenuProps, IContextualMenuItem, DirectionalHint, ContextualMenu } from 'office-ui-fabric-react/lib/ContextualMenu';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { Pivot, PivotItem, PivotLinkFormat, PivotLinkSize } from 'office-ui-fabric-react/lib/Pivot';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Callout } from 'office-ui-fabric-react/lib/Callout';

import { getWikiImageUrl } from '../utils/wikiImage.js';
import { exportExcel } from '../utils/excelExporter.js';
import { exportCsv } from '../utils/csvExporter.js';
import { shareCrew } from '../utils/pastebin.js';
import { matchCrew } from '../utils/crewTools.js';
import { matchShips } from '../utils/shipTools.js';

import { LoginDialog } from './LoginDialog.js';
import { ShipList } from './ShipList.js';
import { ItemList } from './ItemList.js';
import { CrewList } from './CrewList.js';
import { GauntletHelper } from './GauntletHelper.js';
import { MissionHelper } from './MissionHelper.js';
import { CrewRecommendations } from './CrewRecommendations.js';
import { AboutAndHelp } from './AboutAndHelp.js';
import { FleetDetails } from './FleetDetails.js';
import { ShareDialog } from './ShareDialog.js';
import { EquipmentDetails } from './EquipmentDetails.js';
import { CaptainCard } from './CaptainCard.js';

import STTApi from '../api/STTApi.ts';

const loki = require('lokijs');
const path = require('path');
const electron = require('electron');
const app = electron.app || electron.remote.app;
const shell = electron.shell;

const CONFIG = require('../utils/config.js');

class App extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showSpinner: false,
			dataLoaded: false,
			isCaptainCalloutVisible: false,
			captainName: 'Welcome!',
			secondLine: '',
			captainAvatarUrl: '',
			captainAvatarBodyUrl: '',
			fleetId: null,
			crewList: [],
			shipList: [],
			itemList: [],
			allequipment: [],
			missionHelperParams: {},
			cadetMissionHelperParams: {},
			spinnerLabel: 'Loading...'
		};

		this.dbCache = null;
		this.imageURLs = null;
		this._captainButtonElement = null;

		this._onAccessToken = this._onAccessToken.bind(this);
		this._getCommandItems = this._getCommandItems.bind(this);
		this._onShare = this._onShare.bind(this);
		this._onCaptainClicked = this._onCaptainClicked.bind(this);
		this._onCaptainCalloutDismiss = this._onCaptainCalloutDismiss.bind(this);
		this._onDataFinished = this._onDataFinished.bind(this);
		this._onDataError = this._onDataError.bind(this);

		if (CONFIG.UserConfig.getValue('autoLogin') == true) {
			this.state.showSpinner = true;
			this.state.showLoginDialog = false;
			STTApi.loginWithCachedAccessToken(CONFIG.UserConfig.getValue('accessToken'));
			this._onAccessToken();
		}
		else {
			this.state.showLoginDialog = true;
		}
	}

	_onCaptainClicked() {
		if (!this.state.showSpinner)
			this.setState({ isCaptainCalloutVisible: !this.state.isCaptainCalloutVisible });
	}

	_onCaptainCalloutDismiss() {
		this.setState({
			isCaptainCalloutVisible: false
		});
	}

	render() {
		return (
			<Fabric className='App'>
				<div className='lcars'>
					<div className='lcars-corner-left' />
					<div className='lcars-content'>
						<Image src={this.state.captainAvatarUrl} height={25} />
					</div>
					<div className='lcars-ellipse' />
					<div className='lcars-content-text'>
						<span style={{ cursor: 'pointer' }} onClick={this._onCaptainClicked} ref={(menuButton) => this._captainButtonElement = menuButton}>{this.state.captainName}</span>
						{this.state.isCaptainCalloutVisible && (
							<Callout className='CaptainCard-callout'
								role={'alertdialog'}
								gapSpace={0}
								targetElement={this._captainButtonElement}
								onDismiss={this._onCaptainCalloutDismiss}
								setInitialFocus={true}
							>
								<CaptainCard captainAvatarBodyUrl={this.state.captainAvatarBodyUrl} />
							</Callout>
						)}
					</div>
					<div className='lcars-box' />
					<div className='lcars-content-text'>
						{this.state.secondLine}
					</div>
					<div className='lcars-corner-right' />
				</div>

				{this.state.showSpinner && (
					<Spinner size={SpinnerSize.large} label={this.state.spinnerLabel} /> 
				)}

				{this.state.dataLoaded && (
					<Pivot linkFormat={PivotLinkFormat.tabs} linkSize={PivotLinkSize.large}>
						<PivotItem linkText='Crew' itemIcon='Teamwork'>
							<CommandBar items={this._getCommandItems()} />
							<CrewList data={this.state.crewList} grouped={false} ref='crewList' />
						</PivotItem>
						<PivotItem linkText='Items' itemIcon='Boards'>
							<ItemList data={this.state.itemList} imageURLs={this.imageURLs} />
						</PivotItem>
						<PivotItem linkText='Equipment' itemIcon='CheckList'>
							<EquipmentDetails crewList={this.state.crewList} allequipment={this.state.allequipment} />
						</PivotItem>
						<PivotItem linkText='Ships' itemIcon='Airplane'>
							<ShipList data={this.state.shipList} imageURLs={this.imageURLs} />
						</PivotItem>
						<PivotItem linkText='Missions' itemIcon='Ribbon'>
							<MissionHelper params={this.state.missionHelperParams} dbCache={this.dbCache} />
						</PivotItem>
						<PivotItem linkText='Cadet' itemIcon='Trophy'>
							<MissionHelper params={this.state.cadetMissionHelperParams} dbCache={this.dbCache} />
						</PivotItem>
						<PivotItem linkText='Recommendations' itemIcon='Lightbulb'>
							<CrewRecommendations crew={this.state.crewList} cadetMissions={this.state.cadetMissionHelperParams} missions={this.state.missionHelperParams} dbCache={this.dbCache} />
						</PivotItem>
						<PivotItem linkText='Gauntlet' itemIcon='DeveloperTools'>
							<GauntletHelper crew={this.state.crewList} imageURLs={this.imageURLs} />
						</PivotItem>
						<PivotItem linkText='Fleet' itemIcon='WindDirection'>
							<FleetDetails id={this.state.fleetId} imageURLs={this.imageURLs} />
						</PivotItem>
						<PivotItem linkText='About' itemIcon='Help'>
							<AboutAndHelp />
						</PivotItem>
					</Pivot>
				)}

				<LoginDialog ref='loginDialog' onAccessToken={this._onAccessToken} shownByDefault={this.state.showLoginDialog} />
				<ShareDialog ref='shareDialog' onShare={this._onShare} />
			</Fabric>
		);
	}

	_getCommandItems()
	{
		return [
			{
				key: 'exportExcel',
				name: 'Export Excel',
				icon: 'ExcelLogo',
				onClick: function () {
					const { dialog } = require('electron').remote;

					dialog.showSaveDialog(
						{
							filters: [ { name: 'Excel sheet (*.xlsx)', extensions: ['xlsx'] } ],
							title: 'Export Star Trek Timelines crew roster',
							defaultPath: 'My Crew.xlsx',
							buttonLabel: 'Export'
						},
						function (fileName) {
							if (fileName === undefined)
								return;

							exportExcel(this.state.crewList, this.state.itemList, this.state.shipList, fileName, function (filePath) {
								shell.openItem(filePath);
							});
						}.bind(this));

				}.bind(this)
			},
			{
				key: 'exportCsv',
				name: 'Export CSV',
				icon: 'ExcelDocument',
				onClick: function () {
					const { dialog } = require('electron').remote;

					dialog.showSaveDialog(
						{
							filters: [{ name: 'Comma separated file (*.csv)', extensions: ['csv'] }],
							title: 'Export Star Trek Timelines crew roster',
							defaultPath: 'My Crew.csv',
							buttonLabel: 'Export'
						},
						function (fileName) {
							if (fileName === undefined)
								return;

							exportCsv(this.state.crewList, fileName, function (filePath) {
								shell.openItem(filePath);
							});
						}.bind(this));

				}.bind(this)
			},
			{
				key: 'share',
				name: 'Share',
				icon: 'Share',
				onClick: function () {
					this.refs.shareDialog._showDialog(this.state.captainName);
				}.bind(this)
			},
			{
				key: 'configure',
				name: 'Configure',
				icon: 'Settings',
				subMenuProps: {
					items: [
						{
							key: 'grouping',
							name: 'Group options',
							subMenuProps: {
								items: [
									{
										key: 'none',
										name: 'None',
										//canCheck: true,
										//checked: this.refs.crewList ? (this.refs.crewList.getGroupedColumn() == '') : false,
										onClick: function () { this.refs.crewList.setGroupedColumn(''); }.bind(this)
									},
									{
										key: 'rarity',
										name: 'Group by rarity',
										//canCheck: true,
										//checked: this.refs.crewList ? (this.refs.crewList.getGroupedColumn() == 'max_rarity') : false,
										onClick: function () { this.refs.crewList.setGroupedColumn('max_rarity'); }.bind(this)
									}
								]
							}
						}
					]
				}
			}
		];
	}

	_onShare(options) {
		shareCrew(this.dbCache, this.state.crewList, options, this.state.missionHelperParams, this.state.cadetMissionHelperParams, function (url) {
			shell.openItem(url);
		});
	}

	componentWillUnmount() {
		if (this.dbCache) {
			this.dbCache.close();
		}
	}

	_onAccessToken(autoLogin) {
		CONFIG.UserConfig.setValue('autoLogin', autoLogin);
		CONFIG.UserConfig.setValue('accessToken', STTApi.accessToken);

		this.setState({ showSpinner: true });

		this.dbCache = new loki(path.join(app.getPath('userData'), 'storage', 'cache.json'), { autosave: true, autoload: true });
		this.imageURLs = this.dbCache.getCollection('imageURLs');
		if (!this.imageURLs) {
			this.imageURLs = this.dbCache.addCollection('imageURLs');
		}

		this.setState({ spinnerLabel: 'Loading crew information...' });
		STTApi.loadCrewArchetypes(function (error, success) {
			this.setState({ spinnerLabel: 'Loading server configuration...' });
			if (success) {
				STTApi.loadServerConfig(function (error, success) {
					this.setState({ spinnerLabel: 'Loading platform configuration...' });
					if (success) {
						STTApi.loadPlatformConfig(function (error, success) {
							this.setState({ spinnerLabel: 'Loading player data...' });
							if (success) {
								STTApi.loadPlayerData(function (error, success) {
									this.setState({ spinnerLabel: 'Finishing up...' });
									if (success) {
										// Successfully loaded all the needed data
										this._onDataFinished();
									} else {
										this._onDataError();
									}
								}.bind(this));
							} else {
								this._onDataError();
							}
						}.bind(this));
					} else {
						this._onDataError();
					}
				}.bind(this));
			} else {
				this._onDataError();
			}
		}.bind(this));
	}

	_onDataError() {
		this.setState({ showSpinner: false });
		this.refs.loginDialog._showDialog('Unknown network error, failed to load!');
	}

	_onDataFinished() {
		this.setState({
			showSpinner: false,
			captainName: STTApi.playerData.character.display_name,
			secondLine: 'Level ' + STTApi.playerData.character.level,
			itemList: STTApi.playerData.character.items,
			fleetId: STTApi.playerData.fleet ? STTApi.playerData.fleet.id : nullptr,
			missionHelperParams: {
				accepted_missions: STTApi.playerData.character.accepted_missions,
				dispute_histories: STTApi.playerData.character.dispute_histories
			},
			cadetMissionHelperParams: {
				accepted_missions: STTApi.playerData.character.cadet_schedule.missions
			}
		});

		if (STTApi.playerData.character.crew_avatar) {
			getWikiImageUrl(this.imageURLs, STTApi.playerData.character.crew_avatar.name.split(' ').join('_') + '_Head.png', 0, function (id, url) {
				this.setState({ captainAvatarUrl: url });
			}.bind(this));

			getWikiImageUrl(this.imageURLs, STTApi.playerData.character.crew_avatar.name.split(' ').join('_') + '.png', 0, function (id, url) {
				this.setState({ captainAvatarBodyUrl: url });
			}.bind(this));
		}

		// all the equipment available in the game, along with sources and recipes
		var allequipment = [];
		STTApi.itemArchetypeCache.archetypes.forEach(function (archetype) {
			var newEquipment = {
				name: archetype.name,
				id: archetype.id,
				rarity: archetype.rarity,
				type: archetype.type, // 3 - no recipe, can only get from sources; 2 - otherwise
				short_name: archetype.short_name, // only for type 3
				recipe: archetype.recipe ? archetype.recipe.demands : null, //optional
				item_sources: archetype.item_sources,
				icon: archetype.icon.file,
				iconUrl: CONFIG.defaultItemIconUrl
			};

			allequipment.push(newEquipment);
		});

		this.setState({ allequipment: allequipment });

		allequipment.forEach(function (equipment) {
			var fileName = equipment.name + CONFIG.rarityRes[equipment.rarity].name + '.png';
			fileName = fileName.split(' ').join('');
			fileName = fileName.split('\'').join('');

			getWikiImageUrl(this.imageURLs, fileName, equipment.id, function (id, url) {
				this.state.allequipment.forEach(function (item) {
					if ((item.id === id) && url)
						item.iconUrl = url;
				});
			}.bind(this));
		}.bind(this));

		matchCrew(this.dbCache, STTApi.playerData.character, function (roster) {
			roster.forEach(function (crew) {
				crew.iconUrl = '';
				crew.iconBodyUrl = '';
			});

			this.setState({ dataLoaded: true, crewList: roster });

			roster.forEach(function (crew) {
				getWikiImageUrl(this.imageURLs, crew.name.split(' ').join('_') + '_Head.png', crew.id, function (id, url) {
					this.state.crewList.forEach(function (crew) {
						if (crew.id === id)
							crew.iconUrl = url;
					});

					this.forceUpdate();
				}.bind(this));
				getWikiImageUrl(this.imageURLs, crew.name.split(' ').join('_') + '.png', crew.id, function (id, url) {
					this.state.crewList.forEach(function (crew) {
						if (crew.id === id)
							crew.iconBodyUrl = url;
					});

					this.forceUpdate();
				}.bind(this));
			}.bind(this));
		}.bind(this));

		matchShips(STTApi.playerData.character.ships, function (ships) {
			this.setState({ shipList: ships });
		}.bind(this));
	}
}

export default App;
