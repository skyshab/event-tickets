var ticketHeaderImage = window.ticketHeaderImage || {};

(function( window, $, undefined ) {
	'use strict';

	// base elements
	var $body                            = $( 'html, body' );
	var $document                        = $( document );
	var $tribe_tickets                   = $( document.getElementById( 'tribetickets' ) );

	// Bail if we don't have what we need
	if ( 0 === $tribe_tickets.length ) {
		return;
	}

	var $tickets_container               = $( document.getElementById( 'event_tickets' ) );
	var $post_id                         = $( document.getElementById( 'post_ID' ) );

	var $metaboxBlocker                  = $tribe_tickets.find( '.tribe-tickets-editor-blocker' );
	var $spinner                         = $tribe_tickets.find( '.spinner' );

	// panels
	var $panels                          = $( document.getElementById( 'event_tickets' ) ).find( '.ticket_panel' );
	var $base_panel                      = $( document.getElementById( 'tribe_panel_base' ) );
	var $edit_panel                      = $( document.getElementById( 'tribe_panel_edit' ) );
	var $settings_panel                  = $( document.getElementById( 'tribe_panel_settings' ) );

	// stock elements
	var global_capacity_setting_changed  = false;
	// date elements
	var $event_pickers                   = $( document.getElementById( 'tribe-event-datepickers' ) );
	var $ticket_start_date               = $( document.getElementById( 'ticket_start_date' ) );
	var $ticket_end_date                 = $( document.getElementById( 'ticket_end_date' ) );
	var $ticket_start_time               = $( document.getElementById( 'ticket_start_time' ) );
	var $ticket_end_time                 = $( document.getElementById( 'ticket_end_time' ) );
	var startofweek                      = 0;
	// misc ticket elements
	var $ticket_image_preview            = $( document.getElementById( 'tribe_ticket_header_preview' ) );
	var $ticket_show_description         = $( document.getElementById( 'tribe_tickets_show_description' ) );

	// Datepicker and Timepicker variables
	var datepickerFormats = [
		'yy-mm-dd',
		'm/d/yy',
		'mm/dd/yy',
		'd/m/yy',
		'dd/mm/yy',
		'm-d-yy',
		'mm-dd-yy',
		'd-m-yy',
		'dd-mm-yy',
		'yy.mm.dd',
		'mm.dd.yy',
		'dd.mm.yy'
	];
	var dateFormat = datepickerFormats[0];
	var time_format = 'HH:mmA';

	function format_date( date ) {
		if ( 'undefined' === typeof date ) {
			// An empty string will give us now() below
			date = '';
		}

		// tribe_datepicker uses 'YY' for full year, moment uses 'YYYY'
		// This is a bit sketchy,
		// moment.js is deprecating use of strings in any format other than ISO (YYYY-MM-DD).
		// But they allow you to use js Date() to do the parsing for you.
		return moment( new Date( date ) ).format( dateFormat.toUpperCase().replace( 'YY', 'YYYY' ) );
	}

	function format_time( date ) {
		if ( 'undefined' === typeof date ) {
			// An empty string will give us now() below
			date = '';
		}

		// Passing in the format allows us to only provide a time portion
		// (no need fo a Date() object) but this does make it a bit brittle
		return moment( date, time_format ).format( time_format );
	}

	/**
	 * Returns the currently selected default ticketing provider.
	 * Defaults to RSVP if something fails
	 *
	 * @since TBD
	 *
	 * @return string
	 */
	function get_default_provider() {
		var $checked_provider = $( 'input[name=default_ticket_provider]', '#tribe_panel_settings' ).filter( ':checked' );
		return ( $checked_provider.length > 0 ) ? $checked_provider.val() : 'Tribe__Tickets__RSVP';
	}

	/**
	 * Sets the ticket edit form provider to the currently selected default ticketing provider.
	 * Defaults to RSVP if something fails
	 *
	 * @since TBD
	 *
	 * @param boolean force selection to RSVP
	 * @return void
	 */
	function set_default_provider_radio( force_rsvp ) {
		force_rsvp = 'undefined' !== typeof force_rsvp;
		var $checked_provider = $( 'input[name="default_ticket_provider"]', '#tribe_panel_settings' ).filter( ':checked' );
		var provider_id = 'Tribe__Tickets__RSVP_radio';

		if ( ! force_rsvp && $checked_provider.length > 0 ) {
			provider_id = $checked_provider.val() + '_radio';
		 }

		$( document.getElementById( provider_id ) ).prop( 'checked', true ).trigger( 'change' );
	}

	/**
	 * When a ticket type is edited we should (re-)establish the UI for showing
	 * and hiding its history, if it has one.
	 */
	function show_hide_ticket_type_history() {
		var $history = $tribe_tickets.find( '.ticket_advanced.history' );

		if ( ! $history.length ) {
			return;
		}

		$history.on( 'click', '.toggle-history', function( e ) {
			e.preventDefault();
			if ( $history.hasClass( '_show' ) ) {
				$history.removeClass( '_show' );
			} else {
				$history.addClass( '_show' );
			}
		} );
	}

	/**
	 * Returns the current global capacity (via the settings panel)
	 *
	 * @since TBD
	 *
	 * @return {number}
	 */
	function get_global_cap() {
		var $global_capacity_edit = $( document.getElementById( 'settings_global_capacity_edit' ) );
		return ( 0 < $global_capacity_edit.length && 0 < $global_capacity_edit.val() ) ? $global_capacity_edit.val() : 0;
	}

	/**
	 * Switch from one panel to another
	 * @param  event  e      triggering event
	 * @param  object ($base_panel) $panel jQuery object containing the panel we want to switch to
	 * @return void
	 */
	function show_panel( e, $panel ) {
		if ( e ) {
			e.preventDefault();
		}

		// this way if we don't pass a panel, it works like a 'reset'
		if ( 'undefined' === typeof $panel ) {
			$panel = $base_panel;
		}

		// First, hide them all!
		$panels.each( function() {
			$( this ).attr( 'aria-hidden', true );
		} );

		// then show the one we want
		$panel.attr( 'aria-hidden', false );

		if ( ! $panel.is( $base_panel ) ) {
			$( window ).on( 'beforeunload.tribe', beforeUnload );
			$( document.getElementById( 'publish' ) ).prop( 'disabled', true );
		} else {
			$( window ).off( 'beforeunload.tribe' );
			$( document.getElementById( 'publish' ) ).prop( 'disabled', false );
		}
	}

	/**
	 * Refreshes the base and settings panels when we've changed something
	 *
	 * @since TBD
	 *
	 * @param string optional notice to prepend to the ticket table
	 * @param bool (true) flag for panel swap
	 * @return void
	 */
	function refresh_panels( notice, swap ) {
		// make sure we have this for later (default to true)
		swap = 'undefined' === typeof swap;

		var params = {
			action       : 'tribe-ticket-refresh-panels',
			notice       : notice,
			post_ID      : $post_id.val(),
			ticket_order : $( document.getElementById( 'tribe_tickets_order' ) ).val(),
			nonce        : TribeTickets.add_ticket_nonce
		};

		if ( 'settings-cancel' === notice ) {
			params.action = 'tribe-ticket-refresh-settings';
		}

		$.post(
			ajaxurl,
			params,
			function( response ) {
				// Ticket table
				if ( response.data.ticket_table && '' != response.data.ticket_table ) {
					// remove old ticket table
					var $ticket_table = $( document.getElementById( 'ticket_list_wrapper' ) );

					if ( 0 === $ticket_table.length ) {
						// if it's not there, create it :(
						var $container = $( '.tribe_sectionheader.ticket_list_container' );
						$ticket_table = $( '<div>', {id: "ticket_list_wrapper"});
						$container.append( $ticket_table );

						if ( $container.hasClass( 'tribe_no_capacity' ) ) {
							$container.removeClass( 'tribe_no_capacity' );
						}
					}

					$ticket_table.empty();

					// create new ticket table (and notice)
					var $new_table = $( '<div>' );
					$new_table.html( response.data.ticket_table );

					// insert new ticket table
					$ticket_table.append( $new_table );
				}

				// Settings table
				if ( 'undefined' !== typeof response.data.capacity_table ) {
					$( document.getElementById( 'tribe_expanded_capacity_table' ) ).replaceWith( response.data.capacity_table );
				}

				// Settings table
				if ( 'undefined' !== typeof response.data.settings_panel ) {
					var $newSettingsPanel = $( response.data.settings_panel );
					$settings_panel.replaceWith( $newSettingsPanel );

					// replaces the global variable
					$settings_panel = $newSettingsPanel;
				}

				// Total Capacity line
				if ( 'undefined' !== typeof response.data.total_capacity ) {
					var $current_cap_line = $( document.getElementById( 'ticket_form_total_capacity' ) );
					if ( 0 < $current_cap_line.length ) {
						$current_cap_line.replaceWith( response.data.total_capacity );
					} else {
						var $wrap = $( '<div class="ticket_table_intro">' );
						$wrap.append( response.data.total_capacity );
						$( '.ticket_list_container' ).removeClass( 'tribe_no_capacity' ).prepend( $wrap );
					}
				}

				// Set Provider radio on ticket form
				set_default_provider_radio();
			}
		).complete( function( response ) {
			$tribe_tickets.trigger( 'tribe-tickets-refresh-tables', response.data );

			if ( swap ) {
				show_panel();
			}
		} );
	}

	/**
	 * If the user attempts to nav away without saving global stock setting
	 * changes then try to bring this to their attention!
	 */
	var beforeUnload = function( event ) {
		var returnValue = false;

		// If we are not on the base panel we alert the user about leaving
		if ( $tribe_tickets.find( '.ticket_panel' ).filter( '[aria-hidden="false"]' ).is( $base_panel ) ) {
			returnValue = tribe_global_stock_admin_ui.nav_away_msg;
		}

		event.returnValue = returnValue;

		// We can't trigger a confirm() dialog from within this action but returning
		// a string should achieve effectively the same result
		return returnValue;
	};

	ticketHeaderImage = {
		// Call this from the upload button to initiate the upload frame.
		uploader: function() {
			var frame = wp.media( {
				title   : HeaderImageData.title,
				multiple: false,
				library : { type: 'image' },
				button  : { text: HeaderImageData.button }
			} );

			// Handle results from media manager.
			frame.on( 'close', function() {
				var attachments = frame.state().get( 'selection' ).toJSON();
				if ( attachments.length ) {
					ticketHeaderImage.render( attachments[0] );
				}
			} );

			frame.open();
			return false;
		},
		// Output Image preview and populate widget form.
		render  : function( attachment ) {
			$ticket_image_preview.html( ticketHeaderImage.imgHTML( attachment ) );
			$( document.getElementById( 'tribe_ticket_header_image_id' ) ).val( attachment.id );
			$( document.getElementById( 'tribe_ticket_header_remove' ) ).show();
			$( document.getElementById( 'tribe_tickets_image_preview_filename' ) ).show().find( '.filename' ).text( attachment.filename );
		},
		// Render html for the image.
		imgHTML : function( attachment ) {
			var img_html = '<img src="' + attachment.url + '" ';
			img_html += 'width="' + attachment.width + '" ';
			img_html += 'height="' + attachment.height + '" ';
			img_html += '/>';
			return img_html;
		}
	};

	$document.ajaxSend( function( event, jqxhr, settings ) {
		if ( 'string' !== $.type( settings.data ) ) {
			return;
		}

		if ( -1 === settings.data.indexOf( 'action=tribe-ticket' ) ) {
			return;
		}

		$tribe_tickets.trigger( 'spin.tribe', 'start' );
	} );

	$document.ajaxComplete( function( event, jqxhr, settings ) {
		if ( 'string' !== $.type( settings.data ) ) {
			return;
		}

		if ( -1 === settings.data.indexOf( 'action=tribe-ticket' ) ) {
			return;
		}

		$tribe_tickets.trigger( 'spin.tribe', 'stop' );
	} );

	/* Add some trigger actions */
	$document.on( {
		/**
		 * Makes a Visual Spinning thingy appear on the Tickets metabox.
		 * Also prevents user Action on the metabox elements.
		 *
		 * @param  {jQuery.event} event  The jQuery event
		 * @param  {string} action You can use `start` or `stop`
		 * @return {void}
		 */
		'spin.tribe': function( event, action ) {
			if ( 'undefined' === typeof action || $.inArray( action, [ 'start', 'stop' ] ) ){
				action = 'stop';
			}

			if ( 'stop' === action ) {
				$metaboxBlocker.hide();
				$spinner.removeClass( 'is-active' );
			} else {
				$metaboxBlocker.show();
				$spinner.addClass( 'is-active' );
			}
		},

		/**
		 * Clears the Form fields the correct way
		 *
		 * @return {void}
		 */
		'clear.tribe': function() {
			var $textFields = $edit_panel.find( 'input:not(:button):not(:radio):not(:checkbox):not([type="hidden"]), textarea' );
			var $checkFields = $edit_panel.find( 'input:checkbox, input:radio' );
			var $idField = $edit_panel.find( '#ticket_id' );

			// some fields may have a default value we don't want to lose after clearing the form
			$edit_panel.find( 'input[data-default-value]' ).each( function() {
				var $current_field = $( this );
				$current_field.val( $current_field.data( 'default-value' ) );
			} );

			// Reset the min/max datepicker settings so that they aren't inherited by the next ticket that is edited
			$ticket_start_date.datepicker( 'option', 'maxDate', null )
			$ticket_start_date.val( $.datepicker.formatDate( dateFormat, new Date() ) )
			$ticket_start_date.trigger( 'change' );

			var startDateTime = new Intl.DateTimeFormat( 'en-US', { hour: 'numeric', minute: 'numeric' } ).format( new Date() );
			$ticket_start_time.val( startDateTime );
			$ticket_start_time.trigger( 'change' );

			// event end date, time
			$ticket_end_date.datepicker( 'option', 'minDate', null ).val(  $( document.getElementById( 'EventStartDate' ) ).val() ).trigger( 'change' );
			$ticket_end_time.val( $( document.getElementById( 'EventEndTime' ) ).val() ).trigger( 'change' );

			$edit_panel.find( '#ticket_price' ).removeProp( 'disabled' )
				.siblings( '.no-update-message' ).html( '' ).hide()
				.end().siblings( '.description' ).show();

			$( document.getElementById( 'tribe-tickets-attendee-sortables' ) ).empty();

			$( '.accordion-content.is-active' ).removeClass( 'is-active' );

			$( document.getElementById( 'ticket_bottom_right' ) ).empty();

			$edit_panel.find( '.accordion-header, .accordion-content' ).removeClass( 'is-active' );

			$textFields.val( '' ).trigger( 'change' );
			$checkFields.prop( 'checked', false ).trigger( 'change' );
			$idField.val( '' ).trigger( 'change' );
			$edit_panel.find( '.tribe-tickets-editor-history-container' ).remove();
		},

		/**
		 * When the edit ticket form fields have completed loading we can setup
		 * other UI features as needed.
		 */
		'edit-tickets-complete.tribe': function() {
			show_hide_ticket_type_history();
		}
	} );

	/* "Settings" button action */
	$document.on( 'click', '#settings_form_toggle', function( e ) {
		show_panel( e, $settings_panel );
	} );

	/* Settings "Cancel" button action */
	$document.on( 'click', '#tribe_settings_form_cancel', function( e ) {
		refresh_panels( 'settings-cancel' );
	} );

	/* "Save Settings" button action */
	$document.on( 'click', '#tribe_settings_form_save', function( e ) {
		e.preventDefault();

		// Do this first to prevent weirdness with global capacity
		var $global_capacity_edit = $( document.getElementById( 'settings_global_capacity_edit' ) )
		if ( false === $global_capacity_edit.prop( 'disabled' ) ) {
			$global_capacity_edit.blur();
			$global_capacity_edit.prop( 'disabled', true );
		}

		var form_data = $settings_panel.find( '.settings_field' ).serialize();
		var params    = {
			action  : 'tribe-ticket-save-settings',
			formdata: form_data,
			post_ID : $post_id.val(),
			nonce   : TribeTickets.add_ticket_nonce
		};

		$.post(
			ajaxurl,
			params,
			function( response ) {
				$tribe_tickets.trigger( 'saved-image.tribe', response );
				if ( response.success ) {
					refresh_panels( 'settings' );
				}
			},
			'json'
		);
	} );

	/* "Add ticket" button action */
	$document.on( 'click', '.ticket_form_toggle', function( e ) {
		e.preventDefault();
		var $default_provider = get_default_provider();
		var global_cap = get_global_cap();
		var start_date;
		var start_time;
		var end_date;
		var end_time;

		$tribe_tickets.trigger( 'clear.tribe' );

		if ( 'rsvp_form_toggle' === $( this ).closest( 'button' ).attr( 'id' ) ) {
			set_default_provider_radio( true );
		} else {
			set_default_provider_radio();
			// Only want to do this if we're setting up a ticket - as opposed to an RSVP
			$( document.getElementById( $default_provider + '_' + tribe_ticket_vars.stock_mode ) ).prop( 'checked', true );
			$( document.getElementById( $default_provider + '_global_capacity' ) ).val( global_cap );

			if ( 0 !== global_cap && '' !== global_cap ) {
				$( document.getElementById( $default_provider + '_global_stock_block') ).find(  '.global_capacity-wrapper' ).addClass( 'screen-reader-text' );
			} else {
				$( document.getElementById( $default_provider + '_global_stock_block') ).find(  '.global_capacity-wrapper' ).removeClass( 'screen-reader-text' );
			}

			$( document.getElementById( $default_provider + '_global_stock_cap' ) ).attr( 'placeholder', global_cap );
		}

		$edit_panel.find( '.tribe-dependency' ).trigger( 'verify.dependency' );

		$ticket_show_description.prop( 'checked', true );

		// Hide the sale price field - it doesn't apply for new tickets
		$( document.getElementById( 'ticket_sale_price' ) ).closest( '.input_block' ).hide();

		// We have to trigger this after verify.dependency, as it enables this field and we want it disabled
		if ( 'ticket_form_toggle' === $( this ).attr( 'id' ) &&  0 < global_cap ) {
			$( document.getElementById( $default_provider + '_global_capacity' ) ).prop( 'disabled', true );
		}

		var now = new Date();

		// handle all the date stuff
		if ( undefined !== $( document.getElementById( 'EventStartDate' ) ).val() ) {
			start_date = format_date( new Date( $( document.getElementById( 'EventStartDate' ) ).val() ) );
		} else {
			start_date = format_date( now );
		}
		$ticket_start_date.val( start_date ).trigger( 'change' );

		if ( undefined !== $( document.getElementById( 'EventStartTime' ) ).val() ) {
			start_time = format_time( $( document.getElementById( 'EventStartTime' ) ).val() );
		} else {
			start_time = format_time( now );
		}
		$ticket_start_time.val( start_time ).trigger( 'change' );

		if ( undefined !== $( document.getElementById( 'EventEndDate' ) ).val() ) {
			end_date = format_date( new Date( $( document.getElementById( 'EventEndDate' ) ).val() ) );
		} else {
			end_date = '';
		}
		$ticket_end_date.val( end_date ).trigger( 'change' );

		if ( undefined !== $( document.getElementById( 'EventEndTime' ) ).val() ) {
			end_time = format_time( $( document.getElementById( 'EventEndTime' ) ).val() );
		} else {
			end_time = '';
		}
		$ticket_end_time.val( end_time ).trigger( 'change' );

		$( '.tribe-tickets-attendee-saved-fields' ).show();

		show_panel( e, $edit_panel );
	} );

	/* Ticket "Cancel" button action */
	$document.on( 'click', '#ticket_form_cancel', function( e ) {
		refresh_panels();
		$tribe_tickets.trigger( 'clear.tribe' );
	} );

	/* Change global stock type if we've put a value in global_stock_cap */
	$document.on( 'change', '.tribe-ticket-field-stock-cap', function( e ) {
		var $this = $( this );
		var $globalField = $this.parents( '.input_block' ).eq( 0 ).find( '.tribe-ticket-field-mode' );

		// Bail if we have any value on Stock Cap
		if ( ! $this.val() ) {
			return;
		}

		$globalField.val( 'capped' );
	} );

	/* "Save Ticket" button action */
	$document.on( 'click.tribe', '[name="ticket_form_save"]', function( e ) {
		var $form = $( document.getElementById( 'ticket_form_table' ) );

		// Makes sure we have validation
		$form.trigger( 'validation.tribe' );

		// Prevent anything from happening when there are errors
		if ( tribe.validation.hasErrors( $form ) ) {
			return;
		}

		$tribe_tickets.trigger( 'save-ticket.tribe', e );

		var params = {
			action  : 'tribe-ticket-add-' + $( 'input[name=ticket_provider]:checked' ).val(),
			formdata: $form.find( '.ticket_field' ).serialize(),
			post_ID : $post_id.val(),
			nonce   : TribeTickets.add_ticket_nonce
		};

		$.post(
			ajaxurl,
			params,
			function( response ) {
				$tribe_tickets.trigger( 'saved-ticket.tribe', response );

				if ( response.success ) {
					refresh_panels( 'ticket' );
				}
			},
			'json'
		);
	} );

	/* "Delete Ticket" link action */
	$document.on( 'click', '.ticket_delete', function( e ) {
		if ( ! confirm( tribe_ticket_notices.confirm_alert ) ) {
			return false;
		}

		e.preventDefault();

		$tribe_tickets.trigger( 'delete-ticket.tribe', e );

		var deleted_ticket_id = $( this ).attr( 'attr-ticket-id' );

		var params = {
			action   : 'tribe-ticket-delete-' + $( this ).attr( 'attr-provider' ),
			post_ID  : $post_id.val(),
			ticket_id: deleted_ticket_id,
			nonce    : TribeTickets.remove_ticket_nonce
		};

		$.post(
			ajaxurl,
			params,
			function( response ) {
				$tribe_tickets.trigger( 'deleted-ticket.tribe', response );

				if ( response.success ) {
					// remove deleted ticket from table
					var $deleted_row = $( document.getElementById( 'tribe_ticket_list_table' ) ).find( '[data-ticket-order-id="order_' + deleted_ticket_id + '"]' );
					$deleted_row.remove();

					refresh_panels( 'delete' );

					show_panel( e );
				}
			},
			'json'
		);
	} );

	/* "Edit Ticket" link action */
	$document.on( 'click', '.ticket_edit_button', function( e ) {
		e.preventDefault();

		var ticket_id = this.getAttribute( 'data-ticket-id' );

		var params = {
			action   : 'tribe-ticket-edit-' + this.getAttribute( 'data-provider' ),
			post_ID  : $post_id.val(),
			ticket_id: ticket_id,
			nonce    : TribeTickets.edit_ticket_nonce
		};

		$.post(
			ajaxurl,
			params,
			function( response ) {
				if ( ! response ) {
					return;
				}

				var regularPrice = response.data.price;
				var salePrice    = regularPrice;
				var onSale       = false;
				var provider_class = response.data.provider_class;
				var start_date;
				var start_time;
				var end_date;
				var end_time;

				// trigger a change event on the provider radio input so the advanced fields can be re-initialized
				$( 'input:radio[name=ticket_provider]' ).filter( '[value=' + response.data.provider_class + ']' ).click();
				$( 'input[name=ticket_provider]:radio' ).change();

				// Capacity/Stock
				if ( response.data.global_stock_mode ) {
					switch ( response.data.global_stock_mode ) {
						case 'global':
							$( document.getElementById( provider_class + '_global' ) ).prop( 'checked', true ).val( 'global' );
							$( document.getElementById( provider_class + '_global_capacity' ) ).val( response.data.event_capacity ).prop( 'disabled', true );
							$( document.getElementById( provider_class + '_global_stock_cap' ) ).attr( 'placeholder', response.data.capacity );
							$( document.getElementById( provider_class + '_global_stock_cap' ) ).val( '' );

							break;
						case 'capped':
							$( document.getElementById( provider_class + '_global' ) ).prop( 'checked', true ).val( 'capped' );
							$( document.getElementById( provider_class + '_global_capacity' ) ).val( response.data.event_capacity ).prop( 'disabled', true );
							$( document.getElementById( provider_class + '_global_stock_cap' ) ).attr( 'placeholder', response.data.capacity );

							if ( undefined !== response.data.capacity && $.isNumeric( response.data.capacity ) && 0 < response.data.capacity ) {
								$( document.getElementById( provider_class + '_global_stock_cap' ) ).val( response.data.capacity );
							} else {
								$( document.getElementById( provider_class + '_global_stock_cap' ) ).val( 0 );
							}

							break;
						case 'own':
							$( document.getElementById( provider_class + '_own' ) ).prop( 'checked', true );
							$( document.getElementById( provider_class + '_capacity' ) ).val( response.data.capacity );
							break;
						default:
							// Just in case
							$( document.getElementById( provider_class + '_unlimited' ) ).prop( 'checked', true );
							$( document.getElementById( provider_class + '_global_stock_cap' ) ).val( '' );
					}
				} else {
					$( document.getElementById( response.data.provider_class + '_unlimited' ) ).prop( 'checked', true );
					$( document.querySelectorAll( '.ticket_stock' ) ).val( response.data.original_stock );
				}

				$( 'input[name=ticket_global_stock]:radio' ).change();

				$( document.getElementById( 'ticket_id' ) ).val( response.data.ID );
				$( document.getElementById( 'ticket_name' ) ).val( response.data.name );
				$( document.getElementById( 'ticket_description' ) ).val( response.data.description );

				// Compare against 0 for backwards compatibility.
				if ( 0 === parseInt( response.data.show_description ) ) {
					$ticket_show_description.prop( 'checked', true );
				} else {
					$ticket_show_description.removeAttr( 'checked' );
				}

				// handle all the date stuff
				var now = Date.now();

				if ( response.data.start_date ) {
					start_date = format_date( response.data.start_date );
				} else if ( undefined !== $( document.getElementById( 'EventStartDate' ) ).val() ) {
					start_date = format_date( $( document.getElementById( 'EventStartDate' ) ).val() );
				} else {
					start_date = format_date( now );
				}

				if ( response.data.start_time ) {
					start_time = format_time( response.data.start_time );
				} else if ( undefined !== $( document.getElementById( 'EventStartTime' ) ).val() ) {
					start_time = format_time( $( document.getElementById( 'EventStartTime' ) ).val() );
				} else {
					start_time = format_time( now );
				}

				$ticket_start_date.val( start_date ).trigger( 'change' );
				$ticket_start_time.val( start_time ).trigger( 'change' );

				if ( response.data.end_date ) {
					end_date = format_date( response.data.end_date );
				} else if ( undefined !== $( document.getElementById( 'EventEndDate' ) ).val() ) {
					end_date = format_date( $( document.getElementById( 'EventEndDate' ) ).val() );
				} else {
					end_date = '';
				}

				if ( response.data.end_time ) {
					end_time = format_time( response.data.end_time );
				} else if ( undefined !== $( document.getElementById( 'EventEndTime' ) ).val() ) {
					end_time = format_time( $( document.getElementById( 'EventEndTime' ) ).val() );
				} else {
					end_time = '';
				}

				$ticket_end_date.val( end_date ).trigger( 'change' );
				$ticket_end_time.val( end_time ).trigger( 'change' );

				$( document.getElementById( 'advanced_fields' ) ).empty( '' ).append( response.data.advanced_fields );

				// set the prices
				if ( 'undefined' !== typeof response.data.on_sale && response.data.on_sale ) {
					onSale       = true;
					regularPrice = response.data.regular_price;
				}

				var $ticket_price = $tribe_tickets.find( '#ticket_price' );
				$ticket_price.val( regularPrice );

				if ( 'undefined' !== typeof response.data.disallow_update_price_message ) {
					$ticket_price.siblings( '.no-update-message' ).html( response.data.disallow_update_price_message );
				} else {
					$ticket_price.siblings( '.no-update-message' ).html( '' );
				}

				if ( 'undefined' !== typeof response.data.can_update_price && ! response.data.can_update_price ) {
					$ticket_price.prop( 'disabled', 'disabled' );
					$ticket_price.siblings( '.description' ).hide();
					$ticket_price.siblings( '.no-update-message' ).show();
				} else {
					$ticket_price.removeProp( 'disabled' );
					$ticket_price.siblings( '.description' ).show();
					$ticket_price.siblings( '.no-update-message' ).hide();
				}

				// History Content
				if ( 'undefined' !== typeof response.data.history ) {
					var $historyContent = $( response.data.history );

					$edit_panel.find( '.accordion' ).append( $historyContent );
					window.MTAccordion( {
						target: '.accordion', // ID (or class) of accordion container
					} );
				} else {
					$edit_panel.find( '.tribe-tickets-editor-history-container' ).remove();
				}

				var $sale_field     = $( document.getElementById( 'ticket_sale_price' ) );
				var $sale_container = $sale_field.closest( '.input_block' )

				if ( onSale ) {
					$sale_field.prop( 'readonly', false ).val( salePrice ).prop( 'readonly', true );
					$sale_container.show();
				} else {
					$sale_container.hide();
				}

				if ( 'undefined' !== typeof response.data.purchase_limit && response.data.purchase_limit ) {
					$( document.getElementById( 'ticket_purchase_limit' ) ).val( response.data.purchase_limit );
				}

				if ( response.data.sku ) {
					$( document.querySelectorAll( '.sku_input' ) ).val( response.data.sku );
				}

				$( document.getElementById( 'tribe-tickets-attendee-sortables' ) ).empty();

				if ( 'undefined' !== typeof response.data.attendee_fields && response.data.attendee_fields ) {
					$( document.getElementById( 'tribe-tickets-attendee-sortables' ) ).html( response.data.attendee_fields );
					$( '.tribe-tickets-attendee-saved-fields' ).hide();
				} else {
					$( '.tribe-tickets-attendee-saved-fields' ).show();
				}

				if ( 'undefined' !== typeof response.data.controls && response.data.controls ) {
					$( document.getElementById( 'ticket_bottom_right' ) ).html( response.data.controls );
				}

				$tribe_tickets.find( '.tribe-bumpdown-trigger' ).bumpdown();

				$( 'a#ticket_form_toggle' ).hide();

				$edit_panel.find( '.tribe-dependency' ).trigger( 'verify.dependency' );
			},
			'json'
		).always( function( response ) {
			$tribe_tickets.trigger( 'edit-tickets-complete.tribe' );

			// re-trigger all dependencies
			$edit_panel.find( '.tribe-dependency' ).trigger( 'verify.dependency' );

			if ( response.data.event_capacity ) {
				$( document.getElementById( response.data.provider_class + '_global_capacity' ) ).prop( 'disabled', true );
			}

			show_panel( e, $edit_panel );
		} );
	} );

	/* Handle editing global capacity from the settings panel */
	$document.on( 'click', '#global_capacity_edit_button', function( e ) {
		e.preventDefault();
		$( document.getElementById( 'settings_global_capacity_edit' ) ).prop( 'disabled', false ).focus();
	} );

	$document.on( 'keyup', '#ticket_price', function ( e ) {
		e.preventDefault();

		var decimal_point = price_format.decimal;
		var regex         = new RegExp( '[^\-0-9\%\\' + decimal_point + ']+', 'gi' );
		var value         = $( this ).val();
		var newvalue      = value.replace( regex, '' );

		// @todo add info message or tooltip to let people know we are removing the comma or period
		if ( value !== newvalue ) {
			$( this ).val( newvalue );
		}
	} );

	$document.on( 'click', '#tribe_ticket_header_image, #tribe_ticket_header_preview', function( e ) {
		e.preventDefault();
		ticketHeaderImage.uploader( '', '' );
	} );

	/* Handle saving changes to capacity from Settings form */
	$document.on( 'blur', '#settings_global_capacity_edit', function() {
		var $capacity = $( this );
		var capacity = $capacity.val();

		if ( '' === capacity ) {
			$capacity.val( 0 );
			capacity = 0;
		}

		var params = {
			action   : 'tribe-events-edit-global-capacity',
			post_ID  : $post_id.val(),
			capacity : capacity,
			nonce    : TribeTickets.edit_ticket_nonce
		};

		$.post(
			ajaxurl,
			params,
			function( response ) {
				$( document.getElementById('settings_global_capacity_edit') ).prop( 'disabled', true );
				refresh_panels( null, false );
			}
		);
	} );

	/* Track changes to the global stock level on the ticket edit form. */
	$document.on( 'blur', '[name=tribe-tickets-global-stock]', function() {
		$tribe_tickets.trigger( 'tribe_tickets_global_capacity_setting_changed', $( this ).attr( 'id' ) );
	} );

	/** Track changes to the global stock level on the Settings form.  */
	$document.on( 'change', '#tribe-tickets-global-stock-level', function() {
		$tribe_tickets.trigger( 'tribe_tickets_global_capacity_setting_changed', $( this ).attr( 'id' ) );
	} );

	/**
	 * React to changes in global stock
	 * @param string - id of element where the change occurred
	 */
	$document.on( 'tribe_tickets_global_capacity_setting_changed', function( event, location ) {
		// without a location, there's no point
		if ( undefined === location ) {
			return;
		}

		var cap_val = $( document.getElementById( location ) ).val();

		if ( undefined === cap_val ) {
			return
		}

		// may as well set this here just in case
		$( '[name="tribe-tickets[capacity]"]' ).attr( 'placeholder', cap_val );

		// change the global variable for checks later
		global_capacity_setting_changed = true;
	} );

	/* Remove header image action */
	$document.on( 'click', '#tribe_ticket_header_remove', function( e ) {
		e.preventDefault();
		$( document.getElementById( 'tribe_ticket_header_preview' ) ).html( '' );
		$( document.getElementById( 'tribe_ticket_header_remove' ) ).hide();
		$( document.getElementById( 'tribe_tickets_image_preview_filename' ) ).hide().find( '.filename' ).text( '' );
		$( document.getElementById( 'tribe_ticket_header_image_id' ) ).val( '' );

	} );

	$document.ready( function() {
		if ( $event_pickers.length ) {
			startofweek = $event_pickers.data( 'startofweek' );
		}
		if ( 'undefined' !== typeof tribe_dynamic_help_text ) {
			var indexDatepickerFormat =  $.isNumeric( tribe_dynamic_help_text.datepicker_format_index ) ? tribe_dynamic_help_text.datepicker_format_index : 0;
			dateFormat = datepickerFormats[ indexDatepickerFormat ];
		}

		var datepickerOpts = {
			dateFormat     : dateFormat,
			showAnim       : 'fadeIn',
			changeMonth    : true,
			changeYear     : true,
			numberOfMonths : 3,
			firstDay       : startofweek,
			showButtonPanel: false,
			onChange       : function() {
			},
			onSelect       : function( dateText, inst ) {
				var the_date = $.datepicker.parseDate( 'yy-mm-dd', dateText );
				if ( inst.id === 'ticket_start_date' ) {
					$ticket_end_date.datepicker( 'option', 'minDate', the_date );
				} else {
					$ticket_start_date.datepicker( 'option', 'maxDate', the_date );
				}
			}
		};

		$.extend( datepickerOpts, tribe_l10n_datatables.datepicker );

		var $timepickers = $tribe_tickets.find( '.tribe-timepicker:not(.ui-timepicker-input)' );
		tribe_timepickers.setup_timepickers( $timepickers );

		$ticket_start_date.datepicker( datepickerOpts ).datepicker( 'option', 'defaultDate', $( document.getElementById( 'EventStartDate' ) ).val() ).keyup( function( e ) {
			if ( e.keyCode === 8 || e.keyCode === 46 ) {
				$.datepicker._clearDate( this );
			}
		} );

		$ticket_end_date.datepicker( datepickerOpts ).datepicker( 'option', 'defaultDate', $( document.getElementById( 'EventEndDate' ) ).val() ).keyup( function( e ) {
			if ( e.keyCode === 8 || e.keyCode === 46 ) {
				$.datepicker._clearDate( this );
			}
		} );

		if ( $ticket_image_preview.find( 'img' ).length ) {
			$( document.getElementById( 'tribe_ticket_header_remove' ) ).show();

			var $tiximg = $ticket_image_preview.find( 'img' );
			$tiximg.removeAttr( 'width' ).removeAttr( 'height' );

			if ( $tribe_tickets.width() < $tiximg.width() ) {
				$tiximg.css( 'width', '95%' );
			}
		}
	} );

} )( window, jQuery );