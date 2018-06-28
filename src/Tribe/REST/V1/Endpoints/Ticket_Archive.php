<?php

class Tribe__Tickets__REST__V1__Endpoints__Ticket_Archive
	extends Tribe__Tickets__REST__V1__Endpoints__Base
	implements Tribe__REST__Endpoints__READ_Endpoint_Interface,
	Tribe__Documentation__Swagger__Provider_Interface {

	/**
	 * Returns an array in the format used by Swagger 2.0.
	 *
	 * While the structure must conform to that used by v2.0 of Swagger the structure can be that of a full document
	 * or that of a document part.
	 * The intelligence lies in the "gatherer" of informations rather than in the single "providers" implementing this
	 * interface.
	 *
	 * @link http://swagger.io/
	 *
	 * @return array An array description of a Swagger supported component.
	 */
	public function get_documentation() {
		// TODO: Implement get_documentation() method.
	}

	/**
	 * Handles GET requests on the endpoint.
	 *
	 * @param WP_REST_Request $request
	 *
	 * @return WP_Error|WP_REST_Response An array containing the data on success or a WP_Error instance on failure.
	 */
	public function get( WP_REST_Request $request ) {
		$data       = array();
		$query_args = $request->get_query_params();
		$per_page   = $request->get_param( 'per_page' );
		$found      = array();

		$this->ticket_query_args['paged']          = $request->get_param( 'page' );
		$this->ticket_query_args['posts_per_page'] = $request->get_param( 'per_page' );
		$this->found_tickets                       = 0;

		if ( $request->get_param( 'include_post' ) ) {
			$include_post = $request['include_post'];

			foreach ( $include_post as $post_id ) {
				$found[] = $this->get_tickets_for_post( $post_id );
			}

			$found = call_user_func_array( 'array_merge', $found );

			$query_args['include_post'] = implode( ',', $include_post );
		}

		/** @var Tribe__Tickets__REST__V1__Main $main */
		$main = tribe( 'tickets.rest-v1.main' );

		$readable = $this->filter_readable_tickets( $found );

		$data['rest_url']    = add_query_arg( $query_args, $main->get_url( '/tickets/' ) );
		$data['total']       = $this->found_tickets;
		$data['total_pages'] = (int) ceil( $this->found_tickets / $per_page );
		$data['tickets']     = array_map( array( $this->post_repository, 'get_ticket_data' ), $readable );

		$headers = array(
			'X-ET-TOTAL'       => $data['total'],
			'X-ET-TOTAL-PAGES' => $data['total_pages'],
		);

		return new WP_REST_Response( $data, 200, $headers );
	}

	/**
	 * Returns the content of the `args` array that should be used to register the endpoint
	 * with the `register_rest_route` function.
	 *
	 * @return array
	 */
	public function READ_args() {
		// @todo add all the other args
		return array(
			'page'         => array(
				'description'       => __( 'The page of results to return; defaults to 1', 'event-tickets' ),
				'type'              => 'integer',
				'default'           => 1,
				'sanitize_callback' => 'absint',
				'minimum'           => 1,
			),
			'per_page'     => array(
				'description'       => __( 'How many tickets to return per results page; defaults to posts_per_page.', 'event-tickets' ),
				'type'              => 'integer',
				'default'           => get_option( 'posts_per_page' ),
				'minimum'           => 1,
				'maximum'           => 100,
				'sanitize_callback' => 'absint',
			),
			'include_post' => array(
				// @todo support multiple types in Swaggerification functions
				// 'swagger_type' => array('integer', 'array', 'string'),
				'swagger_type'      => 'string',
				'description'       => __( 'Limit results to tickets that are assigned to one of the posts specified in the CSV list or array', 'event-tickets' ),
				'required'          => false,
				'validate_callback' => array( $this->validator, 'is_post_id_list' ),
				'sanitize_callback' => array( $this->validator, 'list_to_array' ),
			),
		);
	}

	/**
	 * Filters the found tickets to only return those the current user can access and formats
	 * the ticket data depending on the current user access rights.
	 *
	 * @since TBD
	 *
	 * @param Tribe__Tickets__Ticket_Object[] $found
	 *
	 * @return array[]
	 */
	protected function filter_readable_tickets( array $found ) {
		$readable = array();

		foreach ( $found as $ticket ) {
			$ticket_id   = $ticket->ID;
			$ticket_data = $this->get_readable_ticket_data( $ticket_id );

			if ( $ticket_data instanceof WP_Error ) {
				continue;
			}

			$readable[] = $ticket_data;
		}

		return $readable;
	}
}
