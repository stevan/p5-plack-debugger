package Plack::Middleware::Debugger::Collector;

use strict;
use warnings;

use parent 'Plack::Middleware';

use Plack::Util::Accessor (
    'debugger', # a reference to the Plack::Debugger
);

sub call {
    my ($self, $env) = @_;

    my $has_cleanup = $env->{'psgix.cleanup'};

    $self->debugger->run_before_phase( $env );

    if ( $has_cleanup ) {
        push @{ $env->{'psgix.cleanup.handlers'} } => (
            sub { $self->debugger->run_cleanup_phase( $env ) },
            sub { $self->debugger->store_results }
        );
    }

    $self->response_cb(
        $self->app->( $env ), 
        sub { 
            my $resp = shift;
            $self->debugger->run_after_phase( $env, $resp );

            # if cleanup is not supported 
            # then our best bet is to try 
            # to store results here.
            if ( !$has_cleanup ) {
                $self->debugger->store_results;
            }
        }
    );
}

1;

__END__